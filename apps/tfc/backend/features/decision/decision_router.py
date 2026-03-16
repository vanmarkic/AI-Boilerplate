from fastapi import APIRouter, Depends, status

from core.dependencies import get_decision_service
from features.decision.decision_schema import (
    CreateDecisionRequest,
    DecisionDetailResponse,
    DecisionResponse,
    ResponseItem,
    SubmitResponseRequest,
)
from features.decision.decision_service import DecisionService

router = APIRouter(prefix="/api/decisions", tags=["decisions"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=DecisionResponse,
    operation_id="createDecision",
)
async def create_decision(
    request: CreateDecisionRequest,
    service: DecisionService = Depends(get_decision_service),
) -> DecisionResponse:
    return await service.create_decision(request)


@router.get(
    "",
    response_model=list[DecisionResponse],
    operation_id="listDecisions",
)
async def list_decisions(
    exercise_id: int,
    status: str | None = None,
    service: DecisionService = Depends(get_decision_service),
) -> list[DecisionResponse]:
    return await service.list_decisions(exercise_id, status)


@router.get(
    "/{decision_id}",
    response_model=DecisionDetailResponse,
    operation_id="getDecision",
)
async def get_decision(
    decision_id: int,
    service: DecisionService = Depends(get_decision_service),
) -> DecisionDetailResponse:
    return await service.get_decision(decision_id)


@router.post(
    "/{decision_id}/responses",
    status_code=status.HTTP_201_CREATED,
    response_model=ResponseItem,
    operation_id="submitResponse",
)
async def submit_response(
    decision_id: int,
    request: SubmitResponseRequest,
    service: DecisionService = Depends(get_decision_service),
) -> ResponseItem:
    return await service.submit_response(decision_id, request)


@router.post(
    "/{decision_id}/close",
    response_model=DecisionResponse,
    operation_id="closeDecision",
)
async def close_decision(
    decision_id: int,
    service: DecisionService = Depends(get_decision_service),
) -> DecisionResponse:
    return await service.close_decision(decision_id)
