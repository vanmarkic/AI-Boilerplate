"""Tests for ExerciseEngine orchestration."""
from unittest.mock import patch

import pytest

from engine.inject_scheduler import InjectType, ScheduledInject
from engine.exercise_engine import EngineConfig, EnginePhase, ExerciseEngine
from engine.defect_manager import TrackedDefect, TriggerMode


def _config(
    injects: list[ScheduledInject] | None = None,
    defects: list[TrackedDefect] | None = None,
    factor: float = 1.0,
) -> EngineConfig:
    return EngineConfig(
        exercise_id=1,
        title="Test Exercise",
        time_factor=factor,
        injects=injects or [],
        defects=defects or [],
    )


def _inject(id: str, scheduled_pt_ms: float = 0.0, **kw: object) -> ScheduledInject:
    return ScheduledInject(
        id=id, title=f"E-{id}", description="", inject_type=InjectType.OPERATIONAL,
        scheduled_pt_ms=scheduled_pt_ms, **kw,
    )


def _defect(id: str, **kw: object) -> TrackedDefect:
    mode = kw.pop("trigger_mode", TriggerMode.MANUAL)
    return TrackedDefect(
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
async def test_tick_processes_injects() -> None:
    inj = _inject("e1", scheduled_pt_ms=0.0, duration_ms=100.0)
    engine = ExerciseEngine(_config(injects=[inj]))
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
        await engine.tick()  # -> pending
    with patch("engine.time_manager._now_ms", return_value=100.0):
        changes = await engine.tick()  # -> running
    assert any(c.get("action") == "started" for c in changes)


@pytest.mark.asyncio
async def test_inject_completion_triggers_linked_defects() -> None:
    inj = _inject("e1", scheduled_pt_ms=0.0, duration_ms=50.0, triggered_defects=["i1"])
    dfct = _defect(
        "i1", trigger_mode=TriggerMode.INJECT_BASED, trigger_inject_id="e1",
    )
    engine = ExerciseEngine(_config(injects=[inj], defects=[dfct]))
    # Start and advance past duration so inject completes
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
        await engine.tick()  # inject -> pending
        await engine.tick()  # inject -> running at pt=0
    with patch("engine.time_manager._now_ms", return_value=100.0):
        changes = await engine.tick()  # inject -> completed, defect activated
    defect_actions = [c["action"] for c in changes if c.get("type") == "defect_change"]
    assert "activated" in defect_actions


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
    assert "injects" in snap
    assert "defects" in snap


# ── Decision integration tests ───────────────────────────────────────────


def _decision_inject(
    id: str, scheduled_pt_ms: float = 0.0, **kw: object,
) -> ScheduledInject:
    return ScheduledInject(
        id=id, title=f"DE-{id}", description="Decision inject",
        inject_type=InjectType.DECISION,
        scheduled_pt_ms=scheduled_pt_ms, **kw,
    )


@pytest.mark.asyncio
async def test_decision_inject_pauses_engine() -> None:
    """A DECISION inject starting should auto-pause the engine."""
    inj = _decision_inject("d1", scheduled_pt_ms=0.0)
    engine = ExerciseEngine(_config(injects=[inj]))
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
        await engine.tick()  # -> pending
        changes = await engine.tick()  # -> running, triggers decision
    # Engine should have auto-paused
    assert engine.phase == EnginePhase.PAUSED
    # A decision_opened change should be in the list
    decision_changes = [c for c in changes if c.get("type") == "decision_opened"]
    assert len(decision_changes) == 1
    assert decision_changes[0]["decision_id"] == "d1"
    # Decision manager should track it
    open_decisions = engine.decision_manager.get_open_decisions()
    assert len(open_decisions) == 1
    assert open_decisions[0].id == "d1"


@pytest.mark.asyncio
async def test_close_decision_resumes_engine() -> None:
    """Closing the last open decision allows resuming the engine."""
    inj = _decision_inject("d1", scheduled_pt_ms=0.0)
    engine = ExerciseEngine(_config(injects=[inj]))
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
        await engine.tick()  # -> pending
        await engine.tick()  # -> running, auto-pause on decision
    assert engine.phase == EnginePhase.PAUSED
    # Close the decision
    change = engine.decision_manager.close_decision("d1", current_pt_ms=100.0)
    assert change is not None
    assert change["type"] == "decision_closed"
    # Engine can now resume
    with patch("engine.time_manager._now_ms", return_value=200.0):
        result = await engine.resume()
    assert engine.phase == EnginePhase.RUNNING
    engine._stop_tick_loop()


def test_snapshot_includes_decisions() -> None:
    """Snapshot should include a decisions key."""
    engine = ExerciseEngine(_config())
    snap = engine.snapshot()
    assert "decisions" in snap
    assert isinstance(snap["decisions"], list)


@pytest.mark.asyncio
async def test_reset_clears_decisions() -> None:
    """Reset should clear all tracked decisions."""
    inj = _decision_inject("d1", scheduled_pt_ms=0.0)
    engine = ExerciseEngine(_config(injects=[inj]))
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
        await engine.tick()  # -> pending
        await engine.tick()  # -> running, opens a decision
    assert len(engine.decision_manager.get_open_decisions()) == 1
    await engine.reset()
    assert len(engine.decision_manager.get_open_decisions()) == 0
    assert engine.decision_manager.snapshot() == []
