"""Tests for event-triggered system degradation.

Verifies that system_effects on ScheduledEvent are applied when
an event transitions to RUNNING (started).
"""

from __future__ import annotations

import pytest

from engine.engine_config import EngineConfig, ScenarioContext
from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import ExerciseEngine
from engine.state_changes import SystemEffect
from engine.system_manager import SystemState


def _config(
    events: list[ScheduledEvent] | None = None,
    initial_system_states: list[SystemState] | None = None,
) -> EngineConfig:
    return EngineConfig(
        exercise_id=1,
        title="Test",
        events=events or [],
        context=ScenarioContext(),
        initial_system_states=initial_system_states or [],
    )


class TestEventSystemEffects:
    """Event system_effects are applied when an event starts."""

    @pytest.mark.asyncio
    async def test_event_with_system_effects_degrades_system(self) -> None:
        """An event with system_effects should degrade system when it starts."""
        from unittest.mock import AsyncMock, patch

        systems = [SystemState(system_id="comms", label="COMMS", power=True, operational="green")]
        evt = ScheduledEvent(
            id="evt-1",
            title="Comms Degradation",
            description="COMMS degrade",
            event_type=EventType.INFORMATIONAL,
            scheduled_pt_ms=0.0,
            system_effects=[
                SystemEffect(system_id="comms", operational_state="yellow", power_state=None),
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
            await engine.tick()  # scheduled -> pending
            await engine.tick()  # pending -> running (system effects apply)

        assert engine.system_manager.systems["comms"].operational == "yellow"

        # Verify callback received system_state_change
        all_changes: list[dict] = []  # type: ignore[type-arg]
        for call in callback.call_args_list:
            all_changes.extend(call[0][0])
        sys_changes = [c for c in all_changes if c.get("type") == "system_state_change"]
        assert len(sys_changes) == 1
        assert sys_changes[0]["system_id"] == "comms"
        assert sys_changes[0]["operational"] == "yellow"

    @pytest.mark.asyncio
    async def test_event_system_effects_power_off(self) -> None:
        """An event can turn a system's power off."""
        from unittest.mock import AsyncMock, patch

        systems = [SystemState(system_id="radar", label="RADAR", power=True, operational="green")]
        evt = ScheduledEvent(
            id="evt-2",
            title="Radar Power Loss",
            description="",
            event_type=EventType.OPERATIONAL,
            scheduled_pt_ms=0.0,
            system_effects=[
                SystemEffect(system_id="radar", power_state=False, operational_state="red"),
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

        assert engine.system_manager.systems["radar"].power is False
        assert engine.system_manager.systems["radar"].operational == "red"

    @pytest.mark.asyncio
    async def test_event_no_system_effects_no_change(self) -> None:
        """An event without system_effects should not touch systems."""
        from unittest.mock import AsyncMock, patch

        systems = [SystemState(system_id="comms", label="COMMS", power=True, operational="green")]
        evt = ScheduledEvent(
            id="evt-3",
            title="No Effects",
            description="",
            event_type=EventType.INFORMATIONAL,
            scheduled_pt_ms=0.0,
        )
        callback = AsyncMock()
        engine = ExerciseEngine(
            _config(events=[evt], initial_system_states=systems),
            on_state_change=callback,
        )
        with patch("engine.time_manager._now_ms", return_value=0.0):
            engine._time.start()
            engine._time._paused = False
            await engine.tick()
            await engine.tick()

        assert engine.system_manager.systems["comms"].operational == "green"
        assert engine.system_manager.systems["comms"].power is True

    def test_apply_event_system_effects_unit(self) -> None:
        """Unit test for _apply_event_system_effects method."""
        systems = [
            SystemState(system_id="s1", label="S1", power=True, operational="green"),
            SystemState(system_id="s2", label="S2", power=False, operational="red"),
        ]
        engine = ExerciseEngine(_config(initial_system_states=systems))
        effects = [
            SystemEffect(system_id="s1", operational_state="yellow", power_state=None),
            SystemEffect(system_id="s2", power_state=True, operational_state=None),
        ]
        changes = engine._apply_event_system_effects(effects)
        assert len(changes) == 2
        assert engine.system_manager.systems["s1"].operational == "yellow"
        assert engine.system_manager.systems["s2"].power is True

    def test_apply_event_system_effects_empty(self) -> None:
        """Empty effects list returns no changes."""
        engine = ExerciseEngine(_config())
        assert engine._apply_event_system_effects([]) == []
