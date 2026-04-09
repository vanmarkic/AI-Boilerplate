from datetime import datetime, timezone

from fastapi import HTTPException, status

from features.decision.decision_model import Decision, DecisionResponseRecord
from features.decision.decision_repository import DecisionRepository
from features.decision.decision_schema import (
    CreateDecisionRequest,
    DecisionDetailResponse,
    DecisionResponse,
    ResponseItem,
    SubmitResponseRequest,
)

VALID_QUESTION_TYPES = {
    "single_choice", "multi_choice", "free_text", "scale",
}
VALID_COMPLETION_MODES = {"first_response", "all_respond", "gm_closes"}


class DecisionService:
    def __init__(self, repository: DecisionRepository) -> None:
        self.repository = repository

    async def create_decision(
        self, request: CreateDecisionRequest,
    ) -> DecisionResponse:
        if request.question_type not in VALID_QUESTION_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid question_type: {request.question_type}",
            )
        if request.completion_mode not in VALID_COMPLETION_MODES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid completion_mode: {request.completion_mode}",
            )
        decision = Decision(
            exercise_id=request.exercise_id,
            defect_id=request.defect_id,
            title=request.title,
            description=request.description,
            question_type=request.question_type,
            options=request.options or None,
            completion_mode=request.completion_mode,
            status="open",
        )
        created = await self.repository.create(decision)
        return self._to_response(created, 0)

    async def get_decision(
        self, decision_id: int,
    ) -> DecisionDetailResponse:
        decision = await self.repository.get_by_id(decision_id)
        if not decision:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Decision not found",
            )
        responses = await self.repository.get_responses(decision_id)
        return DecisionDetailResponse(
            id=decision.id,
            exercise_id=decision.exercise_id,
            defect_id=decision.defect_id,
            title=decision.title,
            description=decision.description,
            question_type=decision.question_type,
            options=decision.options,
            completion_mode=decision.completion_mode,
            status=decision.status,
            created_at=decision.created_at,
            closed_at=decision.closed_at,
            responses=[
                ResponseItem.model_validate(r) for r in responses
            ],
        )

    async def list_decisions(
        self,
        exercise_id: int,
        status_filter: str | None = None,
    ) -> list[DecisionResponse]:
        if status_filter:
            decisions = await self.repository.list_by_exercise_and_status(
                exercise_id, status_filter,
            )
        else:
            decisions = await self.repository.list_by_exercise(exercise_id)
        results: list[DecisionResponse] = []
        for d in decisions:
            count = await self.repository.count_responses(d.id)
            results.append(self._to_response(d, count))
        return results

    async def submit_response(
        self,
        decision_id: int,
        request: SubmitResponseRequest,
    ) -> ResponseItem:
        decision = await self.repository.get_by_id(decision_id)
        if not decision:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Decision not found",
            )
        if decision.status != "open":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Decision is closed",
            )
        score = self._calculate_score(decision, request)
        record = DecisionResponseRecord(
            participant_id=request.participant_id,
            participant_name=request.participant_name,
            selected_options=request.selected_options,
            free_text=request.free_text,
            score=score,
        )
        created = await self.repository.add_response(decision_id, record)
        if decision.completion_mode == "first_response":
            await self._close(decision)
        return ResponseItem.model_validate(created)

    async def close_decision(
        self, decision_id: int,
    ) -> DecisionResponse:
        decision = await self.repository.get_by_id(decision_id)
        if not decision:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Decision not found",
            )
        await self._close(decision)
        count = await self.repository.count_responses(decision_id)
        return self._to_response(decision, count)

    async def _close(self, decision: Decision) -> None:
        decision.status = "closed"
        decision.closed_at = datetime.now(timezone.utc)
        await self.repository.update(decision)

    @staticmethod
    def _calculate_score(
        decision: Decision,
        request: SubmitResponseRequest,
    ) -> float | None:
        if decision.question_type not in ("single_choice", "multi_choice"):
            return None
        if not decision.options or not request.selected_options:
            return None
        options_map = {
            opt["id"]: opt.get("score", 0) for opt in decision.options
        }
        if decision.question_type == "single_choice":
            selected_id = request.selected_options[0] if request.selected_options else None
            if selected_id is None:
                return None
            return float(options_map.get(selected_id, 0))
        total = sum(
            options_map.get(oid, 0) for oid in request.selected_options
        )
        return float(total)

    @staticmethod
    def _to_response(
        decision: Decision, responses_count: int,
    ) -> DecisionResponse:
        return DecisionResponse(
            id=decision.id,
            exercise_id=decision.exercise_id,
            defect_id=decision.defect_id,
            title=decision.title,
            description=decision.description,
            question_type=decision.question_type,
            options=decision.options,
            completion_mode=decision.completion_mode,
            status=decision.status,
            created_at=decision.created_at,
            closed_at=decision.closed_at,
            responses_count=responses_count,
        )
