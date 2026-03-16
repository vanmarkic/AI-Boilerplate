"""Unit tests for ExerciseEngine orchestration."""
import asyncio
import time
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio

from engine.exercise_engine import (
    EngineConfig,
    EnginePhase,
    ExerciseEngine,
)
from engine.event_scheduler import EventType, ScheduledEvent
from engine.issue_manager import TrackedIssue, TriggerMode


def _config(
    events: list[ScheduledEvent] | None = None,
    issues: list[TrackedIssue] | None = None,
    time_factor: float = 1.0,
) -> EngineConfig:
    return EngineConfig(
        exercise_id=1,
        title="Test Exercise",
        time_factor=time_factor,
        events=events or [],
        issues=issues or [],
    )


def _event(
    eid: str = "e1",
    scheduled_pt_ms: float = 0.0,
    duration_ms: float | None = None,
    triggered_issues: list[str] | None = None,
) -> ScheduledEvent:
    return ScheduledEvent(
        id=eid,
        title=f"Event {eid}",
        description="",
        event_type=EventType.OPERATIONAL,
        scheduled_pt_ms=scheduled_pt_ms,
        duration_ms=duration_ms,
        triggered_issues=triggered_issues or [],
    )


def _issue(
    iid: str = "i1",
    trigger_mode: TriggerMode = TriggerMode.TIME_BASED,
    trigger_time_pt_ms: float | None = None,
    trigger_event_id: str | None = None,
) -> TrackedIssue:
    return TrackedIssue(
        id=iid,
        title=f"Issue {iid}",
        description="",
        trigger_mode=trigger_mode,
        trigger_time_pt_ms=trigger_time_pt_ms,
        trigger_event_id=trigger_event_id,
    )


class TestInitialPhase:
    def test_setup_phase(self) -> None:
        engine = ExerciseEngine(_config())
        assert engine.phase == EnginePhase.SETUP


class TestStart:
    @pytest.mark.asyncio
    async def test_setup_to_running(self) -> None:
        engine = ExerciseEngine(_config())
        result = await engine.start()
        assert engine.phase == EnginePhase.RUNNING
        assert result["phase"] == "running"
        engine._stop_tick_loop()

    @pytest.mark.asyncio
    async def test_start_from_completed_errors(self) -> None:
        engine = ExerciseEngine(_config())
        await engine.start()
        await engine.complete()
        result = await engine.start()
        assert "error" in result


class TestPause:
    @pytest.mark.asyncio
    async def test_running_to_paused(self) -> None:
        engine = ExerciseEngine(_config())
        await engine.start()
        result = await engine.pause()
        assert engine.phase == EnginePhase.PAUSED
        assert result["phase"] == "paused"

    @pytest.mark.asyncio
    async def test_pause_from_setup_errors(self) -> None:
        engine = ExerciseEngine(_config())
        result = await engine.pause()
        assert "error" in result


class TestResume:
    @pytest.mark.asyncio
    async def test_paused_to_running(self) -> None:
        engine = ExerciseEngine(_config())
        await engine.start()
        await engine.pause()
        result = await engine.resume()
        assert engine.phase == EnginePhase.RUNNING
        assert result["phase"] == "running"
        engine._stop_tick_loop()


class TestComplete:
    @pytest.mark.asyncio
    async def test_running_to_completed(self) -> None:
        engine = ExerciseEngine(_config())
        await engine.start()
        result = await engine.complete()
        assert engine.phase == EnginePhase.COMPLETED
        assert result["phase"] == "completed"

    @pytest.mark.asyncio
    async def test_complete_from_setup_errors(self) -> None:
        engine = ExerciseEngine(_config())
        result = await engine.complete()
        assert "error" in result


class TestReset:
    @pytest.mark.asyncio
    async def test_reset_returns_to_setup(self) -> None:
        engine = ExerciseEngine(_config())
        await engine.start()
        time.sleep(0.01)
        await engine.tick()
        result = await engine.reset()
        assert engine.phase == EnginePhase.SETUP
        assert engine.time_manager.play_time_ms == 0.0
        assert result["phase"] == "setup"


class TestSetSpeed:
    def test_changes_time_factor(self) -> None:
        engine = ExerciseEngine(_config())
        result = engine.set_speed(3.0)
        assert engine.time_manager.factor == 3.0
        assert result["factor"] == 3.0


class TestTick:
    @pytest.mark.asyncio
    async def test_tick_advances_time(self) -> None:
        engine = ExerciseEngine(_config())
        await engine.start()
        time.sleep(0.015)
        await engine.tick()
        assert engine.time_manager.play_time_ms > 0
        engine._stop_tick_loop()

    @pytest.mark.asyncio
    async def test_tick_processes_events_and_issues(self) -> None:
        evt = _event("e1", scheduled_pt_ms=0, duration_ms=1)
        iss = _issue("i1", trigger_time_pt_ms=0)
        engine = ExerciseEngine(_config(events=[evt], issues=[iss]))
        await engine.start()
        time.sleep(0.015)
        changes = await engine.tick()
        engine._stop_tick_loop()
        assert len(changes) > 0


class TestSnapshot:
    def test_snapshot_structure(self) -> None:
        engine = ExerciseEngine(_config())
        snap = engine.snapshot()
        assert snap["exercise_id"] == 1
        assert snap["title"] == "Test Exercise"
        assert snap["phase"] == "setup"
        assert "time" in snap
        assert "events" in snap
        assert "issues" in snap


class TestOnStateChangeCallback:
    @pytest.mark.asyncio
    async def test_callback_called_on_changes(self) -> None:
        callback = AsyncMock()
        evt = _event("e1", scheduled_pt_ms=0, duration_ms=1)
        engine = ExerciseEngine(
            _config(events=[evt]),
            on_state_change=callback,
        )
        await engine.start()
        time.sleep(0.015)
        await engine.tick()
        engine._stop_tick_loop()
        callback.assert_called()

    @pytest.mark.asyncio
    async def test_callback_not_called_without_changes(self) -> None:
        callback = AsyncMock()
        engine = ExerciseEngine(_config(), on_state_change=callback)
        await engine.start()
        # tick immediately with no events/issues to trigger
        await engine.tick()
        engine._stop_tick_loop()
        callback.assert_not_called()
