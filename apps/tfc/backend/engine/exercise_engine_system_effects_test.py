"""Tests for ExerciseEngine._apply_system_effects (Task 3B).

Verifies that system effects from selected decision options are applied
via SystemManager after a decision is closed.
"""

from __future__ import annotations

import pytest

from engine.engine_config import DecisionTemplate, EngineConfig, ScenarioContext
from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import ExerciseEngine
from engine.state_changes import DecisionOptionSnapshot, SystemEffect
from engine.system_manager import SystemState


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


def _option(
    id: str,
    *,
    score: float = 0.0,
    stress_delta: int = 0,
    system_effects: list[SystemEffect] | None = None,
    targets_system: bool = False,
) -> DecisionOptionSnapshot:
    return DecisionOptionSnapshot(
        id=id,
        label=f"Option {id}",
        score=score,
        stress_delta=stress_delta,
        system_effects=system_effects or [],
        targets_system=targets_system,
        max_plays=1,
        role=None,
    )


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


# ── _apply_system_effects unit tests ─────────────────────────────


class TestApplySystemEffects:
    """Test the _apply_system_effects private method directly."""

    def test_no_effects_returns_empty(self) -> None:
        engine = ExerciseEngine(_config())
        opts = [_option("o1")]
        result = engine._apply_system_effects(opts)
        assert result == []

    def test_power_state_applied(self) -> None:
        """An option with power_state=True should power on the system."""
        systems = [SystemState(system_id="nav", label="NAV", power=False)]
        engine = ExerciseEngine(
            _config(initial_system_states=systems),
        )
        opts = [
            _option(
                "o1",
                system_effects=[
                    SystemEffect(
                        system_id="nav",
                        power_state=True,
                        operational_state=None,
                    ),
                ],
            ),
        ]
        changes = engine._apply_system_effects(opts)
        assert len(changes) == 1
        assert changes[0]["type"] == "system_state_change"
        assert changes[0]["action"] == "power_changed"
        assert changes[0]["system_id"] == "nav"
        assert changes[0]["power"] is True

    def test_operational_state_applied(self) -> None:
        """An option with operational_state should change the system's operational state."""
        systems = [SystemState(system_id="comms", label="COMMS", operational="green")]
        engine = ExerciseEngine(
            _config(initial_system_states=systems),
        )
        opts = [
            _option(
                "o1",
                system_effects=[
                    SystemEffect(
                        system_id="comms",
                        power_state=None,
                        operational_state="red",
                    ),
                ],
            ),
        ]
        changes = engine._apply_system_effects(opts)
        assert len(changes) == 1
        assert changes[0]["action"] == "operational_changed"
        assert changes[0]["operational"] == "red"

    def test_both_power_and_operational(self) -> None:
        """A single effect with both power and operational should produce two changes."""
        systems = [
            SystemState(system_id="radar", label="RADAR", power=False, operational="green"),
        ]
        engine = ExerciseEngine(
            _config(initial_system_states=systems),
        )
        opts = [
            _option(
                "o1",
                system_effects=[
                    SystemEffect(
                        system_id="radar",
                        power_state=True,
                        operational_state="yellow",
                    ),
                ],
            ),
        ]
        changes = engine._apply_system_effects(opts)
        assert len(changes) == 2
        actions = {c["action"] for c in changes}
        assert actions == {"power_changed", "operational_changed"}

    def test_multiple_options_multiple_effects(self) -> None:
        """Multiple options each with effects should all be applied."""
        systems = [
            SystemState(system_id="s1", label="S1", power=False),
            SystemState(system_id="s2", label="S2", operational="green"),
        ]
        engine = ExerciseEngine(
            _config(initial_system_states=systems),
        )
        opts = [
            _option(
                "o1",
                system_effects=[
                    SystemEffect(system_id="s1", power_state=True, operational_state=None),
                ],
            ),
            _option(
                "o2",
                system_effects=[
                    SystemEffect(system_id="s2", power_state=None, operational_state="red"),
                ],
            ),
        ]
        changes = engine._apply_system_effects(opts)
        assert len(changes) == 2

    def test_no_change_skipped(self) -> None:
        """If the system is already in the target state, no change is returned."""
        systems = [SystemState(system_id="s1", label="S1", power=True, operational="red")]
        engine = ExerciseEngine(
            _config(initial_system_states=systems),
        )
        opts = [
            _option(
                "o1",
                system_effects=[
                    SystemEffect(system_id="s1", power_state=True, operational_state="red"),
                ],
            ),
        ]
        changes = engine._apply_system_effects(opts)
        assert changes == []

    def test_unknown_system_skipped(self) -> None:
        """Effects referencing unknown systems produce no changes."""
        engine = ExerciseEngine(_config())
        opts = [
            _option(
                "o1",
                system_effects=[
                    SystemEffect(system_id="nonexistent", power_state=True, operational_state=None),
                ],
            ),
        ]
        changes = engine._apply_system_effects(opts)
        assert changes == []

    def test_empty_options_returns_empty(self) -> None:
        engine = ExerciseEngine(_config())
        assert engine._apply_system_effects([]) == []


# ── Integration: _timeout_loop applies system effects ─────────────


class TestTimeoutLoopSystemEffects:
    """Verify system effects are applied during timeout auto-close."""

    @pytest.mark.asyncio
    async def test_timeout_applies_system_effects(self) -> None:
        """When a decision times out, the auto-selected option's system effects are applied."""
        from unittest.mock import AsyncMock, patch

        from engine.game_modes.simple_collaborative import SimpleCollaborativeMode

        systems = [SystemState(system_id="nav", label="NAV", power=True, operational="green")]
        # Worst-score option has system effects (will be auto-selected on timeout)
        opts = [
            _option(
                "bad",
                score=-10.0,
                system_effects=[
                    SystemEffect(system_id="nav", power_state=None, operational_state="red"),
                ],
            ),
            _option("good", score=10.0),
        ]
        evt = _decision_event("d1")
        dt = DecisionTemplate(
            id="d1",
            title="T",
            description="D",
            issue_id="i1",
            question_type="single_choice",
            options=opts,
            completion_mode="first_response",
            timeout_ms=100.0,
        )
        callback = AsyncMock()
        mode = SimpleCollaborativeMode(decision_sequence=["d1"])
        engine = ExerciseEngine(
            EngineConfig(
                exercise_id=1,
                title="Test",
                events=[evt],
                decision_templates=[dt],
                initial_system_states=systems,
                game_mode=mode,
            ),
            on_state_change=callback,
        )

        # Open the decision
        with patch("engine.time_manager._now_ms", return_value=0.0):
            engine._time.start()
            engine._time._paused = False
            await engine.tick()  # pending
            await engine.tick()  # started -> decision opens

        assert len(engine.decision_manager.get_open_decisions()) == 1

        # Patch asyncio.sleep to avoid real waits; patch monotonic for timeout
        async def _instant_sleep(_: float) -> None:
            pass

        with (
            patch("asyncio.sleep", side_effect=_instant_sleep),
            patch("time.monotonic", return_value=1.0),
        ):
            d = engine.decision_manager.get_open_decisions()[0]
            d.opened_at_rt_ms = 0.0  # force timeout (1000ms > 100ms)
            await engine._timeout_loop()

        # Verify system state changed
        assert engine.system_manager.systems["nav"].operational == "red"

        # Verify the callback received a system_state_change
        all_changes: list[dict] = []  # type: ignore[type-arg]
        for call in callback.call_args_list:
            all_changes.extend(call[0][0])
        sys_changes = [c for c in all_changes if c.get("type") == "system_state_change"]
        assert len(sys_changes) >= 1
        assert sys_changes[0]["system_id"] == "nav"
        assert sys_changes[0]["operational"] == "red"
