"""Tests for ExerciseEngine orchestration."""

from unittest.mock import patch

import pytest

from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import EngineConfig, EnginePhase, EngineStateError, ExerciseEngine
from engine.issue_manager import TrackedIssue, TriggerMode
from engine.system_manager import SystemState


def _config(
    events: list[ScheduledEvent] | None = None,
    issues: list[TrackedIssue] | None = None,
    factor: float = 1.0,
    initial_system_states: list[SystemState] | None = None,
) -> EngineConfig:
    return EngineConfig(
        exercise_id=1,
        title="Test Exercise",
        time_factor=factor,
        events=events or [],
        issues=issues or [],
        initial_system_states=initial_system_states or [],
    )


def _event(id: str, scheduled_pt_ms: float = 0.0, **kw: object) -> ScheduledEvent:
    return ScheduledEvent(
        id=id,
        title=f"E-{id}",
        description="",
        event_type=EventType.OPERATIONAL,
        scheduled_pt_ms=scheduled_pt_ms,
        **kw,
    )


def _issue(id: str, **kw: object) -> TrackedIssue:
    mode = kw.pop("trigger_mode", TriggerMode.MANUAL)
    return TrackedIssue(
        id=id,
        title=f"I-{id}",
        description="",
        trigger_mode=mode,
        **kw,
    )


@pytest.mark.asyncio
async def test_start_transitions_to_briefing() -> None:
    engine = ExerciseEngine(_config())
    result = await engine.start()
    assert engine.phase == EnginePhase.BRIEFING
    assert result["phase"] == "briefing"


@pytest.mark.asyncio
async def test_begin_transitions_to_running() -> None:
    engine = ExerciseEngine(_config())
    await engine.start()
    with patch("engine.time_manager._now_ms", return_value=0.0):
        result = await engine.begin()
    assert engine.phase == EnginePhase.RUNNING
    assert result["phase"] == "running"
    engine._stop_tick_loop()


@pytest.mark.asyncio
async def test_pause_resume_cycle() -> None:
    engine = ExerciseEngine(_config())
    await engine.start()
    with patch("engine.time_manager._now_ms", return_value=0.0):
        await engine.begin()
        result = await engine.pause()
        assert engine.phase == EnginePhase.PAUSED
        assert result["phase"] == "paused"
        result = await engine.resume()
        assert engine.phase == EnginePhase.RUNNING
    engine._stop_tick_loop()


@pytest.mark.asyncio
async def test_complete_from_running() -> None:
    engine = ExerciseEngine(_config())
    await engine.start()
    with patch("engine.time_manager._now_ms", return_value=0.0):
        await engine.begin()
        result = await engine.complete()
    assert engine.phase == EnginePhase.COMPLETED
    assert result["phase"] == "completed"


@pytest.mark.asyncio
async def test_reset_returns_to_setup() -> None:
    engine = ExerciseEngine(_config())
    await engine.start()
    with patch("engine.time_manager._now_ms", return_value=0.0):
        await engine.begin()
        result = await engine.reset()
    assert engine.phase == EnginePhase.SETUP
    assert result["phase"] == "setup"


@pytest.mark.asyncio
async def test_cannot_start_from_completed() -> None:
    engine = ExerciseEngine(_config())
    await engine.start()
    with patch("engine.time_manager._now_ms", return_value=0.0):
        await engine.begin()
        await engine.complete()
        with pytest.raises(EngineStateError):
            await engine.start()


@pytest.mark.asyncio
async def test_tick_processes_events() -> None:
    evt = _event("e1", scheduled_pt_ms=0.0, duration_ms=100.0)
    engine = ExerciseEngine(_config(events=[evt]))
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
        await engine.tick()  # -> pending
    with patch("engine.time_manager._now_ms", return_value=100.0):
        changes = await engine.tick()  # -> running
    assert any(c.get("action") == "started" for c in changes)


@pytest.mark.asyncio
async def test_event_completion_triggers_linked_issues() -> None:
    evt = _event("e1", scheduled_pt_ms=0.0, duration_ms=50.0, triggered_issues=["i1"])
    iss = _issue(
        "i1",
        trigger_mode=TriggerMode.EVENT_BASED,
        trigger_event_id="e1",
    )
    engine = ExerciseEngine(_config(events=[evt], issues=[iss]))
    # Start and advance past duration so event completes
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
        await engine.tick()  # event -> pending
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


def test_snapshot_includes_systems() -> None:
    systems = [SystemState(system_id="nav", label="NAV", power=True)]
    engine = ExerciseEngine(_config(initial_system_states=systems))
    snap = engine.snapshot()
    assert "systems" in snap
    assert len(snap["systems"]) == 1
    assert snap["systems"][0]["system_id"] == "nav"


# ── Decision integration tests ───────────────────────────────────────────


def _decision_event(
    id: str,
    scheduled_pt_ms: float = 0.0,
    **kw: object,
) -> ScheduledEvent:
    return ScheduledEvent(
        id=id,
        title=f"DE-{id}",
        description="Decision event",
        event_type=EventType.DECISION,
        scheduled_pt_ms=scheduled_pt_ms,
        **kw,
    )


@pytest.mark.asyncio
async def test_decision_event_pauses_engine() -> None:
    """A DECISION event starting should auto-pause the engine."""
    evt = _decision_event("d1", scheduled_pt_ms=0.0)
    engine = ExerciseEngine(_config(events=[evt]))
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
    evt = _decision_event("d1", scheduled_pt_ms=0.0)
    engine = ExerciseEngine(_config(events=[evt]))
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
        _result = await engine.resume()
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
    evt = _decision_event("d1", scheduled_pt_ms=0.0)
    engine = ExerciseEngine(_config(events=[evt]))
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
        await engine.tick()  # -> pending
        await engine.tick()  # -> running, opens a decision
    assert len(engine.decision_manager.get_open_decisions()) == 1
    await engine.reset()
    assert len(engine.decision_manager.get_open_decisions()) == 0
    assert engine.decision_manager.snapshot() == []


# ── force_trigger_next_decision emits event_change (#194) ─────────────────


@pytest.mark.asyncio
async def test_force_trigger_next_decision_emits_event_change_with_role_descriptions() -> None:
    """force_trigger_next_decision must emit an event_change carrying
    role_descriptions so the advisor store receives updated event content.

    Regression test for #194: advisor view shows stale event content
    after the CO submits and the turn advances.
    """
    from engine.engine_config import DecisionTemplate
    from engine.game_modes.simple_collaborative import SimpleCollaborativeMode

    role_descs = {"nav": "Check heading", "ops": "Monitor radar"}
    d1_evt = ScheduledEvent(
        id="d1",
        title="Turn 1",
        description="First turn",
        event_type=EventType.DECISION,
        scheduled_pt_ms=999999,
        target_roles=["nav", "ops"],
        role_descriptions=role_descs,
    )
    d2_evt = ScheduledEvent(
        id="d2",
        title="Turn 2",
        description="Second turn",
        event_type=EventType.DECISION,
        scheduled_pt_ms=999999,
        target_roles=["nav", "ops"],
        role_descriptions={"nav": "Verify course", "ops": "Scan contacts"},
    )
    d1_tpl = DecisionTemplate(
        id="d1",
        title="Decision 1",
        description="",
        issue_id="",
        question_type="single_choice",
        options=[],
        completion_mode="gm_closes",
    )
    d2_tpl = DecisionTemplate(
        id="d2",
        title="Decision 2",
        description="",
        issue_id="",
        question_type="single_choice",
        options=[],
        completion_mode="gm_closes",
    )
    mode = SimpleCollaborativeMode(
        decision_sequence=["d1", "d2"],
        base_decision_time_ms=60_000,
    )
    # Advance past d1 so the next call returns d2
    mode.current_index = 1

    cfg = EngineConfig(
        exercise_id=1,
        title="Test",
        events=[d1_evt, d2_evt],
        decision_templates=[d1_tpl, d2_tpl],
        game_mode=mode,
    )
    engine = ExerciseEngine(cfg)
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False

    changes = engine.force_trigger_next_decision(pt=1000.0)

    # Must contain an event_change for d2
    event_changes = [c for c in changes if c.get("type") == "event_change"]
    assert len(event_changes) == 1, (
        f"Expected exactly 1 event_change, got {len(event_changes)}: {event_changes}"
    )
    ec = event_changes[0]
    assert ec["event_id"] == "d2"
    assert ec["lifecycle"] == "running"
    assert ec["target_roles"] == ["nav", "ops"]
    assert ec["role_descriptions"] == {"nav": "Verify course", "ops": "Scan contacts"}
