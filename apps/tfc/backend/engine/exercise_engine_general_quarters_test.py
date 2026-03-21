"""Tests for General Quarters — set_all_power(True) via system_effects.

Verifies that a decision option or event with set_all_power=True
triggers SystemManager.set_all_power(True) for all systems.
"""

from __future__ import annotations

import pytest

from engine.engine_config import DecisionTemplate, EngineConfig, ScenarioContext
from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import ExerciseEngine
from engine.state_changes import DecisionOptionSnapshot, SystemEffect
from engine.system_manager import SystemState


def _config(
    events: list[ScheduledEvent] | None = None,
    decision_templates: list[DecisionTemplate] | None = None,
    initial_system_states: list[SystemState] | None = None,
) -> EngineConfig:
    return EngineConfig(
        exercise_id=1,
        title="Test",
        events=events or [],
        decision_templates=decision_templates or [],
        context=ScenarioContext(),
        initial_system_states=initial_system_states or [],
    )


class TestGeneralQuartersDecisionOption:
    """set_all_power on decision option system_effects."""

    def test_set_all_power_turns_all_systems_on(self) -> None:
        """A decision option with set_all_power=True powers on all systems."""
        systems = [
            SystemState(system_id="s1", label="S1", power=False),
            SystemState(system_id="s2", label="S2", power=False),
            SystemState(system_id="s3", label="S3", power=True),
        ]
        engine = ExerciseEngine(_config(initial_system_states=systems))
        opts = [
            DecisionOptionSnapshot(
                id="gq",
                label="General Quarters",
                score=10.0,
                stress_delta=0,
                system_effects=[
                    SystemEffect(system_id="__all__", power_state=True, operational_state=None, set_all_power=True),
                ],
                targets_system=False,
                max_plays=1,
                role=None,
            ),
        ]
        changes = engine._apply_system_effects(opts)
        # s1 and s2 should change, s3 already on
        assert len(changes) == 2
        assert all(c["action"] == "power_changed" for c in changes)
        assert engine.system_manager.systems["s1"].power is True
        assert engine.system_manager.systems["s2"].power is True
        assert engine.system_manager.systems["s3"].power is True

    def test_set_all_power_with_other_effects(self) -> None:
        """set_all_power can coexist with specific system effects."""
        systems = [
            SystemState(system_id="s1", label="S1", power=False, operational="red"),
            SystemState(system_id="s2", label="S2", power=False),
        ]
        engine = ExerciseEngine(_config(initial_system_states=systems))
        opts = [
            DecisionOptionSnapshot(
                id="gq",
                label="General Quarters",
                score=10.0,
                stress_delta=0,
                system_effects=[
                    SystemEffect(system_id="__all__", power_state=True, operational_state=None, set_all_power=True),
                    SystemEffect(system_id="s1", power_state=None, operational_state="green", set_all_power=False),
                ],
                targets_system=False,
                max_plays=1,
                role=None,
            ),
        ]
        changes = engine._apply_system_effects(opts)
        assert engine.system_manager.systems["s1"].power is True
        assert engine.system_manager.systems["s1"].operational == "green"
        assert engine.system_manager.systems["s2"].power is True


class TestGeneralQuartersEventEffect:
    """set_all_power on event system_effects."""

    def test_event_set_all_power(self) -> None:
        """An event with set_all_power=True powers all systems."""
        systems = [
            SystemState(system_id="s1", label="S1", power=False),
            SystemState(system_id="s2", label="S2", power=False),
        ]
        engine = ExerciseEngine(_config(initial_system_states=systems))
        effects = [
            SystemEffect(system_id="__all__", power_state=True, operational_state=None, set_all_power=True),
        ]
        changes = engine._apply_event_system_effects(effects)
        assert len(changes) == 2
        assert engine.system_manager.systems["s1"].power is True
        assert engine.system_manager.systems["s2"].power is True

    @pytest.mark.asyncio
    async def test_event_triggers_general_quarters_on_start(self) -> None:
        """An event with set_all_power fires during tick when it starts."""
        from unittest.mock import AsyncMock, patch

        systems = [
            SystemState(system_id="s1", label="S1", power=False),
            SystemState(system_id="s2", label="S2", power=False),
        ]
        evt = ScheduledEvent(
            id="evt-gq",
            title="General Quarters",
            description="",
            event_type=EventType.INFORMATIONAL,
            scheduled_pt_ms=0.0,
            system_effects=[
                SystemEffect(system_id="__all__", power_state=True, operational_state=None, set_all_power=True),
            ],
        )
        callback = AsyncMock()
        engine = ExerciseEngine(
            _config(events=[evt], initial_system_states=systems),
            on_state_change=callback,
        )
        with patch("engine.time_manager._now_ms", return_value=0.0):
            engine._time.start()
            engine._time._paused = False
            await engine.tick()  # pending
            await engine.tick()  # running

        assert engine.system_manager.systems["s1"].power is True
        assert engine.system_manager.systems["s2"].power is True
