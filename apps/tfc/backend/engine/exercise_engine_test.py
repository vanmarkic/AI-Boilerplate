"""Tests for ExerciseEngine orchestration."""
from unittest.mock import patch

import pytest

from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import EngineConfig, EnginePhase, ExerciseEngine
from engine.issue_manager import TrackedIssue, TriggerMode


def _config(
    events: list[ScheduledEvent] | None = None,
    issues: list[TrackedIssue] | None = None,
    factor: float = 1.0,
) -> EngineConfig:
    return EngineConfig(
        exercise_id=1,
        title="Test Exercise",
        time_factor=factor,
        events=events or [],
        issues=issues or [],
    )


def _event(id: str, scheduled_pt_ms: float = 0.0, **kw: object) -> ScheduledEvent:
    return ScheduledEvent(
        id=id, title=f"E-{id}", description="", event_type=EventType.OPERATIONAL,
        scheduled_pt_ms=scheduled_pt_ms, **kw,
    )


def _issue(id: str, **kw: object) -> TrackedIssue:
    mode = kw.pop("trigger_mode", TriggerMode.MANUAL)
    return TrackedIssue(
        id=id, title=f"I-{id}", description="",
        trigger_mode=mode,
        **kw,
    )


@pytest.mark.asyncio
async def test_start_transitions_to_running() -> None:
    engine = ExerciseEngine(_config())
    with patch("engine.time_manager._now_ms", return_value=0.0):
        result = await engine.start()
    assert engine.phase == EnginePhase.RUNNING
    assert result["phase"] == "running"
    engine._stop_tick_loop()


@pytest.mark.asyncio
async def test_pause_resume_cycle() -> None:
    engine = ExerciseEngine(_config())
    with patch("engine.time_manager._now_ms", return_value=0.0):
        await engine.start()
        result = await engine.pause()
        assert engine.phase == EnginePhase.PAUSED
        assert result["phase"] == "paused"
        result = await engine.resume()
        assert engine.phase == EnginePhase.RUNNING
    engine._stop_tick_loop()


@pytest.mark.asyncio
async def test_complete_from_running() -> None:
    engine = ExerciseEngine(_config())
    with patch("engine.time_manager._now_ms", return_value=0.0):
        await engine.start()
        result = await engine.complete()
    assert engine.phase == EnginePhase.COMPLETED
    assert result["phase"] == "completed"


@pytest.mark.asyncio
async def test_reset_returns_to_setup() -> None:
    engine = ExerciseEngine(_config())
    with patch("engine.time_manager._now_ms", return_value=0.0):
        await engine.start()
        result = await engine.reset()
    assert engine.phase == EnginePhase.SETUP
    assert result["phase"] == "setup"


@pytest.mark.asyncio
async def test_cannot_start_from_completed() -> None:
    engine = ExerciseEngine(_config())
    with patch("engine.time_manager._now_ms", return_value=0.0):
        await engine.start()
        await engine.complete()
        result = await engine.start()
    assert "error" in result


@pytest.mark.asyncio
async def test_tick_processes_events() -> None:
    evt = _event("e1", scheduled_pt_ms=0.0, duration_ms=100.0)
    engine = ExerciseEngine(_config(events=[evt]))
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
    with patch("engine.time_manager._now_ms", return_value=100.0):
        engine._time._paused = False
        changes = await engine.tick()
    assert any(c.get("action") == "started" for c in changes)


@pytest.mark.asyncio
async def test_event_completion_triggers_linked_issues() -> None:
    evt = _event("e1", scheduled_pt_ms=0.0, duration_ms=50.0, triggered_issues=["i1"])
    iss = _issue(
        "i1", trigger_mode=TriggerMode.EVENT_BASED, trigger_event_id="e1",
    )
    engine = ExerciseEngine(_config(events=[evt], issues=[iss]))
    # Start and advance past duration so event completes
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
        await engine.tick()  # event -> running at pt=0
    with patch("engine.time_manager._now_ms", return_value=100.0):
        changes = await engine.tick()  # event -> completed, issue activated
    issue_actions = [c["action"] for c in changes if c.get("type") == "issue_change"]
    assert "activated" in issue_actions


def test_set_speed_changes_factor() -> None:
    engine = ExerciseEngine(_config(factor=1.0))
    result = engine.set_speed(3.0)
    assert result["factor"] == 3.0
    assert engine.time_manager.factor == 3.0


def test_snapshot_returns_full_state() -> None:
    engine = ExerciseEngine(_config())
    snap = engine.snapshot()
    assert snap["exercise_id"] == 1
    assert snap["title"] == "Test Exercise"
    assert snap["phase"] == "setup"
    assert "time" in snap
    assert "events" in snap
    assert "issues" in snap
