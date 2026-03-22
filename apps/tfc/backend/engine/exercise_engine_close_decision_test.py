"""Tests for ExerciseEngine.close_decision() — canonical decision close path.

Verifies that the engine's public close_decision method handles the full
lifecycle: close → score → forced cards → system effects → advance → complete.
"""

from __future__ import annotations

import pytest

from engine.engine_config import DecisionTemplate, EngineConfig, ScenarioContext
from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import EnginePhase, ExerciseEngine
from engine.game_modes.simple_collaborative import SimpleCollaborativeMode
from engine.state_changes import DecisionOptionSnapshot, SystemEffect
from engine.system_manager import SystemState


def _option(
    id: str,
    *,
    score: float = 0.0,
    stress_delta: int = 0,
    system_effects: list[SystemEffect] | None = None,
    targets_system: bool = False,
    max_plays: int = 0,
) -> DecisionOptionSnapshot:
    return DecisionOptionSnapshot(
        id=id,
        label=f"Option {id}",
        score=score,
        stress_delta=stress_delta,
        system_effects=system_effects or [],
        targets_system=targets_system,
        max_plays=max_plays,
        role=None,
    )


def _build_engine(
    decision_templates: list[DecisionTemplate],
    initial_systems: list[SystemState] | None = None,
) -> ExerciseEngine:
    """Build a running engine with events matching each decision template."""
    events = [
        ScheduledEvent(
            id=dt.id,
            title=f"Event {dt.id}",
            description="",
            event_type=EventType.DECISION,
            scheduled_pt_ms=999_999,
            dependencies=[decision_templates[i - 1].id] if i > 0 else [],
        )
        for i, dt in enumerate(decision_templates)
    ]
    mode = SimpleCollaborativeMode(
        decision_sequence=[dt.id for dt in decision_templates],
        base_decision_time_ms=300_000,
    )
    config = EngineConfig(
        exercise_id=1,
        title="Test",
        events=events,
        decision_templates=decision_templates,
        context=ScenarioContext(),
        initial_system_states=initial_systems or [],
        game_mode=mode,
    )
    return ExerciseEngine(config)


def _single_turn_template(
    tid: str = "d1",
    options: list[DecisionOptionSnapshot] | None = None,
    max_selections: int | None = 1,
    forced_option_ids: list[str] | None = None,
) -> DecisionTemplate:
    return DecisionTemplate(
        id=tid,
        title=f"Decision {tid}",
        description="",
        issue_id="i1",
        question_type="single_choice",
        options=options or [_option("good", score=10.0), _option("bad", score=0.0)],
        completion_mode="consensus",
        target_roles=["co"],
        max_selections=max_selections,
        forced_option_ids=forced_option_ids or [],
    )


class TestCloseDecisionBasic:
    """Engine.close_decision returns all state changes for the full lifecycle."""

    @pytest.mark.asyncio
    async def test_returns_decision_closed_and_score(self) -> None:
        dt = _single_turn_template()
        engine = _build_engine([dt])
        await engine.start()
        await engine.begin()
        pt = engine.time_manager.play_time_ms
        engine.force_trigger_next_decision(pt, "")

        changes = await engine.close_decision("d1", ["good"])

        types = [c["type"] for c in changes]
        assert "decision_closed" in types
        assert "score_change" in types

    @pytest.mark.asyncio
    async def test_single_turn_auto_completes(self) -> None:
        dt = _single_turn_template()
        engine = _build_engine([dt])
        await engine.start()
        await engine.begin()
        pt = engine.time_manager.play_time_ms
        engine.force_trigger_next_decision(pt, "")

        changes = await engine.close_decision("d1", ["good"])

        assert engine.phase == EnginePhase.COMPLETED
        phase_changes = [c for c in changes if c["type"] == "phase_change"]
        assert any(c["phase"] == "completed" for c in phase_changes)

    @pytest.mark.asyncio
    async def test_multi_turn_does_not_complete_on_first(self) -> None:
        dt1 = _single_turn_template("d1")
        dt2 = _single_turn_template("d2")
        engine = _build_engine([dt1, dt2])
        await engine.start()
        await engine.begin()
        pt = engine.time_manager.play_time_ms
        engine.force_trigger_next_decision(pt, "")

        changes = await engine.close_decision("d1", ["good"])

        assert engine.phase == EnginePhase.RUNNING
        # Should have advanced to d2
        types = [c["type"] for c in changes]
        assert "decision_opened" in types

    @pytest.mark.asyncio
    async def test_raises_on_invalid_decision_id(self) -> None:
        dt = _single_turn_template()
        engine = _build_engine([dt])
        await engine.start()
        await engine.begin()

        with pytest.raises(Exception):
            await engine.close_decision("nonexistent", ["good"])

    @pytest.mark.asyncio
    async def test_raises_on_already_closed(self) -> None:
        dt = _single_turn_template()
        engine = _build_engine([dt])
        await engine.start()
        await engine.begin()
        pt = engine.time_manager.play_time_ms
        engine.force_trigger_next_decision(pt, "")

        await engine.close_decision("d1", ["good"])

        with pytest.raises(Exception):
            await engine.close_decision("d1", ["good"])

    @pytest.mark.asyncio
    async def test_raises_on_too_many_selections(self) -> None:
        dt = _single_turn_template(max_selections=1)
        engine = _build_engine([dt])
        await engine.start()
        await engine.begin()
        pt = engine.time_manager.play_time_ms
        engine.force_trigger_next_decision(pt, "")

        with pytest.raises(Exception):
            await engine.close_decision("d1", ["good", "bad"])


class TestCloseDecisionSystemEffects:
    """System effects from selected options are applied via close_decision."""

    @pytest.mark.asyncio
    async def test_applies_system_effects(self) -> None:
        opts = [
            _option(
                "shutdown",
                score=1.0,
                system_effects=[
                    SystemEffect(
                        system_id="nav",
                        power_state=False,
                        operational_state="red",
                        set_all_power=False,
                    ),
                ],
            ),
            _option("keep", score=0.0),
        ]
        dt = _single_turn_template(options=opts)
        systems = [SystemState(system_id="nav", label="NAV", power=True, operational="green")]
        engine = _build_engine([dt], initial_systems=systems)
        await engine.start()
        await engine.begin()
        pt = engine.time_manager.play_time_ms
        engine.force_trigger_next_decision(pt, "")

        changes = await engine.close_decision("d1", ["shutdown"])

        assert engine.system_manager.systems["nav"].power is False
        assert engine.system_manager.systems["nav"].operational == "red"
        sys_changes = [c for c in changes if c.get("type") == "system_state_change"]
        assert len(sys_changes) >= 1


class TestCloseDecisionForcedCards:
    """Forced cards are auto-added and their effects applied."""

    @pytest.mark.asyncio
    async def test_forced_card_system_effects_applied(self) -> None:
        opts = [
            _option("normal", score=5.0),
            _option(
                "forced",
                score=-2.0,
                system_effects=[
                    SystemEffect(
                        system_id="comms",
                        power_state=None,
                        operational_state="yellow",
                        set_all_power=False,
                    ),
                ],
            ),
        ]
        dt = _single_turn_template(
            options=opts,
            forced_option_ids=["forced"],
        )
        systems = [
            SystemState(system_id="comms", label="COMMS", power=True, operational="green"),
        ]
        engine = _build_engine([dt], initial_systems=systems)
        await engine.start()
        await engine.begin()
        pt = engine.time_manager.play_time_ms
        engine.force_trigger_next_decision(pt, "")

        # Player selects "normal" only — "forced" should be auto-added
        changes = await engine.close_decision("d1", ["normal"])

        # Forced card's system effect must be applied
        assert engine.system_manager.systems["comms"].operational == "yellow"
        # Score should include both normal (5) + forced (-2) = 3
        assert engine.game_mode.total_score == 3.0


class TestCloseDecisionTargetSystem:
    """When targets_system=True, player-chosen system_id overrides hardcoded one."""

    @pytest.mark.asyncio
    async def test_target_system_override(self) -> None:
        opts = [
            _option(
                "reboot",
                score=1.0,
                targets_system=True,
                system_effects=[
                    SystemEffect(
                        system_id="placeholder",
                        operational_state="green",
                        power_state=None,
                        set_all_power=False,
                    ),
                ],
            ),
        ]
        dt = _single_turn_template(options=opts)
        systems = [
            SystemState(system_id="nav", label="NAV", power=True, operational="red"),
            SystemState(system_id="aaw", label="AAW", power=True, operational="yellow"),
        ]
        engine = _build_engine([dt], initial_systems=systems)
        await engine.start()
        await engine.begin()
        pt = engine.time_manager.play_time_ms
        engine.force_trigger_next_decision(pt, "")

        changes = await engine.close_decision(
            "d1", ["reboot"], target_system_selections={"reboot": "aaw"},
        )

        assert engine.system_manager.systems["aaw"].operational == "green"
        assert engine.system_manager.systems["nav"].operational == "red"  # unchanged

    @pytest.mark.asyncio
    async def test_missing_target_skips_on_timeout(self) -> None:
        """When target_system_selections is None (timeout path), skip effects."""
        opts = [
            _option(
                "reboot",
                score=1.0,
                targets_system=True,
                system_effects=[
                    SystemEffect(
                        system_id="placeholder",
                        operational_state="green",
                        power_state=None,
                        set_all_power=False,
                    ),
                ],
            ),
        ]
        dt = _single_turn_template(options=opts)
        systems = [SystemState(system_id="nav", label="NAV", power=True, operational="red")]
        engine = _build_engine([dt], initial_systems=systems)
        await engine.start()
        await engine.begin()
        pt = engine.time_manager.play_time_ms
        engine.force_trigger_next_decision(pt, "")

        # None = timeout path — skips system effects, no crash
        changes = await engine.close_decision("d1", ["reboot"])
        assert any(c.get("type") == "decision_closed" for c in changes)
        # System unchanged because effect was skipped
        assert engine.system_manager.systems["nav"].operational == "red"

    @pytest.mark.asyncio
    async def test_missing_target_raises_when_selections_provided(self) -> None:
        """When target_system_selections is {} (player path), raise ValueError."""
        opts = [
            _option(
                "reboot",
                score=1.0,
                targets_system=True,
                system_effects=[
                    SystemEffect(
                        system_id="placeholder",
                        operational_state="green",
                        power_state=None,
                        set_all_power=False,
                    ),
                ],
            ),
        ]
        dt = _single_turn_template(options=opts)
        systems = [SystemState(system_id="nav", label="NAV", power=True, operational="red")]
        engine = _build_engine([dt], initial_systems=systems)
        await engine.start()
        await engine.begin()
        pt = engine.time_manager.play_time_ms
        engine.force_trigger_next_decision(pt, "")

        with pytest.raises(ValueError, match="target system"):
            await engine.close_decision("d1", ["reboot"], target_system_selections={})

    @pytest.mark.asyncio
    async def test_invalid_target_system_raises(self) -> None:
        opts = [
            _option(
                "reboot",
                score=1.0,
                targets_system=True,
                system_effects=[
                    SystemEffect(
                        system_id="placeholder",
                        operational_state="green",
                        power_state=None,
                        set_all_power=False,
                    ),
                ],
            ),
        ]
        dt = _single_turn_template(options=opts)
        systems = [SystemState(system_id="nav", label="NAV", power=True, operational="red")]
        engine = _build_engine([dt], initial_systems=systems)
        await engine.start()
        await engine.begin()
        pt = engine.time_manager.play_time_ms
        engine.force_trigger_next_decision(pt, "")

        with pytest.raises(ValueError, match="not found"):
            await engine.close_decision(
                "d1", ["reboot"], target_system_selections={"reboot": "nonexistent"},
            )

    @pytest.mark.asyncio
    async def test_non_targeting_option_ignores_selections(self) -> None:
        """Options without targets_system=True use hardcoded system_effects."""
        opts = [
            _option(
                "shutdown",
                score=1.0,
                system_effects=[
                    SystemEffect(
                        system_id="nav",
                        power_state=False,
                        operational_state=None,
                        set_all_power=False,
                    ),
                ],
            ),
        ]
        dt = _single_turn_template(options=opts)
        systems = [SystemState(system_id="nav", label="NAV", power=True, operational="green")]
        engine = _build_engine([dt], initial_systems=systems)
        await engine.start()
        await engine.begin()
        pt = engine.time_manager.play_time_ms
        engine.force_trigger_next_decision(pt, "")

        await engine.close_decision("d1", ["shutdown"])
        assert engine.system_manager.systems["nav"].power is False
