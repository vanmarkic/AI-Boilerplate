"""Tests for ExerciseEngine.trigger_event() — canonical event trigger path.

Verifies that the engine's public trigger_event method handles:
force-trigger → event system effects → open decision (if applicable).
"""

from __future__ import annotations

import pytest

from engine.engine_config import DecisionTemplate, EngineConfig, ScenarioContext
from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import ExerciseEngine
from engine.state_changes import DecisionOptionSnapshot, SystemEffect
from engine.system_manager import SystemState


def _option(id: str, *, score: float = 0.0) -> DecisionOptionSnapshot:
    return DecisionOptionSnapshot(
        id=id,
        label=f"Option {id}",
        score=score,
        stress_delta=0,
        system_effects=[],
        targets_system=False,
        max_plays=0,
        role=None,
    )


class TestTriggerEventBasic:
    """Engine.trigger_event returns event_change for a triggerable event."""

    @pytest.mark.asyncio
    async def test_returns_event_change(self) -> None:
        evt = ScheduledEvent(
            id="e1",
            title="Info Event",
            description="",
            event_type=EventType.INFORMATIONAL,
            scheduled_pt_ms=999_999,
        )
        config = EngineConfig(
            exercise_id=1,
            title="Test",
            events=[evt],
            context=ScenarioContext(),
        )
        engine = ExerciseEngine(config)
        await engine.start()
        await engine.begin()

        changes = engine.trigger_event("e1")

        assert len(changes) >= 1
        assert changes[0]["type"] == "event_change"
        assert changes[0]["event_id"] == "e1"

    @pytest.mark.asyncio
    async def test_raises_on_unknown_event(self) -> None:
        config = EngineConfig(
            exercise_id=1,
            title="Test",
            events=[],
            context=ScenarioContext(),
        )
        engine = ExerciseEngine(config)

        with pytest.raises(ValueError, match="nonexistent"):
            engine.trigger_event("nonexistent")


class TestTriggerEventSystemEffects:
    """Triggering an event with system_effects applies them."""

    @pytest.mark.asyncio
    async def test_applies_event_system_effects(self) -> None:
        evt = ScheduledEvent(
            id="e1",
            title="Degrade COMMS",
            description="",
            event_type=EventType.INFORMATIONAL,
            scheduled_pt_ms=999_999,
            system_effects=[
                SystemEffect(
                    system_id="comms",
                    power_state=None,
                    operational_state="yellow",
                    set_all_power=False,
                ),
            ],
        )
        systems = [
            SystemState(system_id="comms", label="COMMS", power=True, operational="green"),
        ]
        config = EngineConfig(
            exercise_id=1,
            title="Test",
            events=[evt],
            context=ScenarioContext(),
            initial_system_states=systems,
        )
        engine = ExerciseEngine(config)
        await engine.start()
        await engine.begin()

        changes = engine.trigger_event("e1")

        assert engine.system_manager.systems["comms"].operational == "yellow"
        sys_changes = [c for c in changes if c.get("type") == "system_state_change"]
        assert len(sys_changes) >= 1


class TestTriggerEventDecision:
    """Triggering a DECISION event opens the decision."""

    @pytest.mark.asyncio
    async def test_opens_decision_for_decision_event(self) -> None:
        from engine.game_modes.simple_collaborative import SimpleCollaborativeMode

        evt = ScheduledEvent(
            id="d1",
            title="Decision Event",
            description="",
            event_type=EventType.DECISION,
            scheduled_pt_ms=999_999,
        )
        dt = DecisionTemplate(
            id="d1",
            title="Pick",
            description="",
            issue_id="i1",
            question_type="single_choice",
            options=[_option("a", score=10.0)],
            completion_mode="consensus",
            target_roles=["co"],
        )
        mode = SimpleCollaborativeMode(decision_sequence=["d1"])
        config = EngineConfig(
            exercise_id=1,
            title="Test",
            events=[evt],
            decision_templates=[dt],
            context=ScenarioContext(),
            game_mode=mode,
        )
        engine = ExerciseEngine(config)
        await engine.start()
        await engine.begin()

        changes = engine.trigger_event("d1")

        types = [c["type"] for c in changes]
        assert "event_change" in types
        assert "decision_opened" in types
        assert len(engine.decision_manager.get_open_decisions()) == 1
