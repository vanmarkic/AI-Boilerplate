"""Unit tests for DecisionService."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from features.decision.decision_schema import (
    CreateDecisionRequest,
    SubmitResponseRequest,
)
from features.decision.decision_service import DecisionService


def _mock_decision(**overrides) -> MagicMock:  # noqa: ANN003
    defaults = {
        "id": 1,
        "exercise_id": 42,
        "issue_id": "issue-1",
        "title": "Test Decision",
        "description": "desc",
        "question_type": "single_choice",
        "options": [
            {"id": "a", "label": "Isolate", "score": 10, "stress_delta": 0, "system_effects": [], "targets_system": False, "max_plays": 1, "role": None},
            {"id": "b", "label": "Ignore", "score": 0, "stress_delta": 0, "system_effects": [], "targets_system": False, "max_plays": 1, "role": None},
        ],
        "completion_mode": "first_response",
        "status": "open",
        "created_at": datetime(2026, 1, 1),
        "closed_at": None,
    }
    defaults.update(overrides)
    mock = MagicMock()
    for k, v in defaults.items():
        setattr(mock, k, v)
    return mock


def _mock_response(**overrides) -> MagicMock:  # noqa: ANN003
    defaults = {
        "id": 1,
        "decision_id": 1,
        "participant_id": "user-1",
        "participant_name": "Alice",
        "selected_options": ["a"],
        "free_text": None,
        "score": 10.0,
        "submitted_at": datetime(2026, 1, 1),
    }
    defaults.update(overrides)
    mock = MagicMock()
    for k, v in defaults.items():
        setattr(mock, k, v)
    return mock


def _make_service() -> tuple[DecisionService, MagicMock]:
    repo = MagicMock()
    return DecisionService(repo), repo


class TestCreateDecision:
    @pytest.mark.asyncio
    async def test_creates_and_returns(self) -> None:
        svc, repo = _make_service()
        repo.create = AsyncMock(return_value=_mock_decision())
        result = await svc.create_decision(
            CreateDecisionRequest(
                title="Test",
                description="desc",
                exercise_id=42,
                issue_id="issue-1",
                question_type="single_choice",
                options=[{"id": "a", "label": "Isolate", "score": 10, "stress_delta": 0, "system_effects": [], "targets_system": False, "max_plays": 1, "role": None}],
                completion_mode="first_response",
            )
        )
        assert result.title == "Test Decision"
        assert result.status == "open"
        repo.create.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_rejects_invalid_question_type(self) -> None:
        svc, _ = _make_service()
        from core.exceptions import BadRequestError

        with pytest.raises(BadRequestError):
            await svc.create_decision(
                CreateDecisionRequest(
                    title="Bad",
                    exercise_id=1,
                    issue_id="x",
                    question_type="invalid",
                    completion_mode="first_response",
                )
            )


class TestSubmitResponse:
    @pytest.mark.asyncio
    async def test_single_choice_scores_correctly(self) -> None:
        svc, repo = _make_service()
        decision = _mock_decision()
        repo.get_by_id = AsyncMock(return_value=decision)
        repo.add_response = AsyncMock(return_value=_mock_response(score=10.0))
        repo.update = AsyncMock()

        result = await svc.submit_response(
            1,
            SubmitResponseRequest(
                participant_id="user-1",
                participant_name="Alice",
                selected_options=["a"],
            ),
        )
        assert result.score == 10.0

    @pytest.mark.asyncio
    async def test_closed_decision_raises_400(self) -> None:
        svc, repo = _make_service()
        repo.get_by_id = AsyncMock(return_value=_mock_decision(status="closed"))
        from core.exceptions import BadRequestError

        with pytest.raises(BadRequestError):
            await svc.submit_response(
                1,
                SubmitResponseRequest(
                    participant_id="u",
                    participant_name="Bob",
                ),
            )

    @pytest.mark.asyncio
    async def test_auto_close_on_first_response(self) -> None:
        svc, repo = _make_service()
        decision = _mock_decision(completion_mode="first_response")
        repo.get_by_id = AsyncMock(return_value=decision)
        repo.add_response = AsyncMock(return_value=_mock_response())
        repo.update = AsyncMock()

        await svc.submit_response(
            1,
            SubmitResponseRequest(
                participant_id="u",
                participant_name="Bob",
                selected_options=["a"],
            ),
        )
        assert decision.status == "closed"
        repo.update.assert_awaited_once()


class TestCloseDecision:
    @pytest.mark.asyncio
    async def test_close_sets_status(self) -> None:
        svc, repo = _make_service()
        decision = _mock_decision()
        repo.get_by_id = AsyncMock(return_value=decision)
        repo.update = AsyncMock()
        repo.count_responses = AsyncMock(return_value=3)

        result = await svc.close_decision(1)
        assert result.status == "closed"
        assert decision.closed_at is not None

    @pytest.mark.asyncio
    async def test_close_nonexistent_raises_404(self) -> None:
        svc, repo = _make_service()
        repo.get_by_id = AsyncMock(return_value=None)
        from core.exceptions import NotFoundError

        with pytest.raises(NotFoundError):
            await svc.close_decision(999)


class TestListDecisions:
    @pytest.mark.asyncio
    async def test_filters_by_exercise_and_status(self) -> None:
        svc, repo = _make_service()
        repo.list_by_exercise_and_status = AsyncMock(
            return_value=[_mock_decision(status="open")],
        )
        repo.count_responses = AsyncMock(return_value=0)

        results = await svc.list_decisions(42, status_filter="open")
        assert len(results) == 1
        assert results[0].status == "open"
        repo.list_by_exercise_and_status.assert_awaited_once_with(42, "open")
