"""Tests for P2 ExerciseEngine additions: decision timeout, role targeting."""
from unittest.mock import AsyncMock, patch

import pytest

from engine.engine_config import DecisionTemplate, EngineConfig, ScenarioContext
from engine.inject_scheduler import InjectType, ScheduledInject
from engine.exercise_engine import EnginePhase, ExerciseEngine


def _decision_inject(
    id: str, scheduled_pt_ms: float = 0.0, **kw: object,
) -> ScheduledInject:
    return ScheduledInject(
        id=id, title=f"DE-{id}", description="Decision inject",
        inject_type=InjectType.DECISION,
        scheduled_pt_ms=scheduled_pt_ms, **kw,
    )


def _config(
    injects: list[ScheduledInject] | None = None,
    decision_templates: list[DecisionTemplate] | None = None,
    context: ScenarioContext | None = None,
) -> EngineConfig:
    return EngineConfig(
        exercise_id=1,
        title="Test",
        injects=injects or [],
        decision_templates=decision_templates or [],
        context=context or ScenarioContext(),
    )


@pytest.mark.asyncio
async def test_decision_template_with_timeout_pauses_engine() -> None:
    """Decision inject with a timeout template should still pause engine."""
    inj = _decision_inject("d1")
    dt = DecisionTemplate(
        id="d1", title="T", description="D", defect_id="i1",
        question_type="single_choice", options=[], completion_mode="first_response",
        timeout_ms=5000.0,
    )
    engine = ExerciseEngine(_config(injects=[inj], decision_templates=[dt]))
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
        await engine.tick()  # -> pending
        changes = await engine.tick()  # -> running, decision opens
    assert engine.phase == EnginePhase.PAUSED
    decision_changes = [c for c in changes if c.get("type") == "decision_opened"]
    assert len(decision_changes) == 1
    assert decision_changes[0]["timeout_ms"] == 5000.0


@pytest.mark.asyncio
async def test_decision_opened_includes_target_roles() -> None:
    inj = _decision_inject("d1")
    dt = DecisionTemplate(
        id="d1", title="T", description="D", defect_id="i1",
        question_type="single_choice", options=[], completion_mode="first_response",
        target_roles=["player", "observer"],
    )
    engine = ExerciseEngine(_config(injects=[inj], decision_templates=[dt]))
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
        await engine.tick()  # -> pending
        changes = await engine.tick()  # -> running, decision opens
    decision_changes = [c for c in changes if c.get("type") == "decision_opened"]
    assert decision_changes[0]["target_roles"] == ["player", "observer"]


@pytest.mark.asyncio
async def test_on_state_change_called_with_decision() -> None:
    """The on_state_change callback should fire when decision opens."""
    callback = AsyncMock()
    inj = _decision_inject("d1")
    engine = ExerciseEngine(_config(injects=[inj]), on_state_change=callback)
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
        await engine.tick()  # -> pending
        await engine.tick()  # -> running, decision opens
    assert callback.call_count >= 1
    # The last call should contain a decision_opened change
    all_changes = []
    for call in callback.call_args_list:
        all_changes.extend(call[0][0])
    assert any(c.get("type") == "decision_opened" for c in all_changes)


@pytest.mark.asyncio
async def test_snapshot_includes_context_fields() -> None:
    ctx = ScenarioContext(
        title="ER Scenario", description="Desc",
        briefing="Brief", objectives=["Obj1"], rules=["Rule1"],
    )
    engine = ExerciseEngine(_config(context=ctx))
    snap = engine.snapshot()
    assert snap["title"] == "Test"
    assert "decisions" in snap


def test_set_speed_updates_factor() -> None:
    engine = ExerciseEngine(_config())
    result = engine.set_speed(5.0)
    assert result["factor"] == 5.0
    assert engine.time_manager.factor == 5.0
