"""Tests for audit service."""
import pytest
from unittest.mock import AsyncMock, MagicMock

from features.audit.audit_schema import CreateAuditEntry
from features.audit.audit_service import AuditService


def _mock_repository() -> MagicMock:
    repo = MagicMock()
    repo.session = MagicMock()
    return repo


class TestAuditLog:
    @pytest.mark.asyncio
    async def test_log_creates_entry(self) -> None:
        repo = _mock_repository()
        entry_mock = MagicMock()
        entry_mock.id = 1
        entry_mock.exercise_id = 42
        entry_mock.entry_type = "phase_change"
        entry_mock.action = "started"
        entry_mock.actor_id = None
        entry_mock.actor_name = None
        entry_mock.target_type = None
        entry_mock.target_id = None
        entry_mock.play_time_ms = 0.0
        entry_mock.real_time_ms = 0.0
        entry_mock.details = None
        entry_mock.created_at = "2026-01-01T00:00:00"
        repo.create = AsyncMock(return_value=entry_mock)
        service = AuditService(repo)

        result = await service.log(CreateAuditEntry(
            exercise_id=42,
            entry_type="phase_change",
            action="started",
        ))
        assert result.exercise_id == 42
        assert result.entry_type == "phase_change"
        assert result.action == "started"
        repo.create.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_exercise_log_returns_entries(self) -> None:
        repo = _mock_repository()
        entry_mock = MagicMock()
        entry_mock.id = 1
        entry_mock.exercise_id = 42
        entry_mock.entry_type = "inject_change"
        entry_mock.action = "activated"
        entry_mock.actor_id = None
        entry_mock.actor_name = None
        entry_mock.target_type = "inject"
        entry_mock.target_id = "e1"
        entry_mock.play_time_ms = 1000.0
        entry_mock.real_time_ms = 500.0
        entry_mock.details = {"inject_id": "e1"}
        entry_mock.created_at = "2026-01-01T00:00:00"
        repo.list_by_exercise = AsyncMock(return_value=[entry_mock])
        service = AuditService(repo)

        results = await service.get_exercise_log(42, entry_type="inject_change")
        assert len(results) == 1
        assert results[0].target_id == "e1"
        repo.list_by_exercise.assert_awaited_once_with(42, entry_type="inject_change")

    @pytest.mark.asyncio
    async def test_get_exercise_log_empty(self) -> None:
        repo = _mock_repository()
        repo.list_by_exercise = AsyncMock(return_value=[])
        service = AuditService(repo)

        results = await service.get_exercise_log(99)
        assert results == []
