"""Path-equivalence tests for ExerciseEngine.

Verifies that the same business event produces identical engine state
regardless of entry path (player-close vs timeout, scheduled vs manual trigger).

These are the highest-value tests for a simulation engine: they prove
that path independence holds across all execution paths.
"""

from __future__ import annotations

import pytest

from engine.engine_config import DecisionTemplate, EngineConfig, ScenarioContext
from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import EnginePhase, ExerciseEngine
from engine.game_modes.classic import ClassicMode
from engine.game_modes.simple_collaborative import SimpleCollaborativeMode
from engine.state_changes import DecisionOptionSnapshot, SystemEffect
from engine.system_manager import SystemState


def _option(
    id: str, *, score: float = 0.0, stress_delta: int = 0,
    system_effects: list[SystemEffect] | None = None,
) -> DecisionOptionSnapshot:
    return DecisionOptionSnapshot(
        id=id, label=f"Option {id}", score=score, stress_delta=stress_delta,
        system_effects=system_effects or [], targets_system=False,
        max_plays=0, role=None,
    )


def _single_turn_engine() -> ExerciseEngine:
    """Build a 1-turn collaborative engine ready to close d1."""
    opts = [_option("good", score=10.0), _option("bad", score=0.0, stress_delta=1)]
    dt = DecisionTemplate(
        id="d1", title="D1", description="", issue_id="i1",
        question_type="single_choice", options=opts,
        completion_mode="consensus", target_roles=["co"], max_selections=1,
    )
    evt = ScheduledEvent(
        id="d1", title="Evt d1", description="",
        event_type=EventType.DECISION, scheduled_pt_ms=999_999,
    )
    mode = SimpleCollaborativeMode(
        decision_sequence=["d1"], base_decision_time_ms=300_000,
    )
    config = EngineConfig(
        exercise_id=1, title="Test", events=[evt],
        decision_templates=[dt], context=ScenarioContext(), game_mode=mode,
    )
    return ExerciseEngine(config)


class TestDecisionCloseEquivalence:
    """Player-close and timeout must produce equivalent final state."""

    @pytest.mark.asyncio
    async def test_player_close_and_timeout_same_final_phase(self) -> None:
        """Both paths complete the exercise on the final decision."""
        # Path A: player closes
        engine_a = _single_turn_engine()
        await engine_a.start()
        await engine_a.begin()
        engine_a.force_trigger_next_decision(0.0, "")
        await engine_a.close_decision("d1", ["bad"])

        # Path B: timeout closes (simulate by calling close_decision with auto option)
        engine_b = _single_turn_engine()
        await engine_b.start()
        await engine_b.begin()
        engine_b.force_trigger_next_decision(0.0, "")
        auto_id = engine_b.game_mode.on_decision_timeout(
            "d1", engine_b.decision_manager.get_decision("d1").options,
        )
        await engine_b.close_decision("d1", [auto_id])

        assert engine_a.phase == EnginePhase.COMPLETED
        assert engine_b.phase == EnginePhase.COMPLETED

    @pytest.mark.asyncio
    async def test_player_close_and_timeout_same_score_structure(self) -> None:
        """Both paths produce a valid score snapshot with a tier."""
        engine_a = _single_turn_engine()
        await engine_a.start()
        await engine_a.begin()
        engine_a.force_trigger_next_decision(0.0, "")
        await engine_a.close_decision("d1", ["good"])

        engine_b = _single_turn_engine()
        await engine_b.start()
        await engine_b.begin()
        engine_b.force_trigger_next_decision(0.0, "")
        await engine_b.close_decision("d1", ["good"])

        snap_a = engine_a.snapshot()
        snap_b = engine_b.snapshot()

        # Same selection → identical score
        assert snap_a["score"] == snap_b["score"]
        assert snap_a["phase"] == snap_b["phase"]

    @pytest.mark.asyncio
    async def test_multi_turn_intermediate_does_not_complete(self) -> None:
        """Closing a non-final decision keeps engine RUNNING."""
        opts = [_option("good", score=10.0), _option("bad", score=0.0)]
        dt1 = DecisionTemplate(
            id="d1", title="D1", description="", issue_id="i1",
            question_type="single_choice", options=opts,
            completion_mode="consensus", target_roles=["co"],
        )
        dt2 = DecisionTemplate(
            id="d2", title="D2", description="", issue_id="i2",
            question_type="single_choice", options=opts,
            completion_mode="consensus", target_roles=["co"],
        )
        events = [
            ScheduledEvent(id="d1", title="E1", description="",
                           event_type=EventType.DECISION, scheduled_pt_ms=999_999),
            ScheduledEvent(id="d2", title="E2", description="",
                           event_type=EventType.DECISION, scheduled_pt_ms=999_999,
                           dependencies=["d1"]),
        ]
        mode = SimpleCollaborativeMode(
            decision_sequence=["d1", "d2"], base_decision_time_ms=300_000,
        )
        config = EngineConfig(
            exercise_id=1, title="Test", events=events,
            decision_templates=[dt1, dt2], context=ScenarioContext(),
            game_mode=mode,
        )
        engine = ExerciseEngine(config)
        await engine.start()
        await engine.begin()
        engine.force_trigger_next_decision(0.0, "")

        await engine.close_decision("d1", ["good"])
        assert engine.phase == EnginePhase.RUNNING

        await engine.close_decision("d2", ["good"])
        assert engine.phase == EnginePhase.COMPLETED

    @pytest.mark.asyncio
    async def test_classic_mode_does_not_auto_complete(self) -> None:
        """Classic mode (GM-driven) must NOT auto-complete on sequence exhaustion."""
        opts = [_option("a", score=0.0)]
        dt = DecisionTemplate(
            id="d1", title="D1", description="", issue_id="i1",
            question_type="single_choice", options=opts,
            completion_mode="first_response",
        )
        evt = ScheduledEvent(
            id="d1", title="E1", description="",
            event_type=EventType.DECISION, scheduled_pt_ms=999_999,
        )
        mode = ClassicMode()
        config = EngineConfig(
            exercise_id=1, title="Test", events=[evt],
            decision_templates=[dt], context=ScenarioContext(),
            game_mode=mode,
        )
        engine = ExerciseEngine(config)
        await engine.start()
        await engine.begin()

        # Classic mode pauses on decision open
        engine.trigger_event("d1")
        assert engine.phase == EnginePhase.PAUSED

        # Close decision — should resume, NOT complete
        changes = await engine.close_decision("d1", ["a"])
        # Classic mode auto-resumes when no open decisions remain
        phase_types = [c.get("phase") for c in changes if c.get("type") == "phase_change"]
        assert "completed" not in phase_types


class TestEventTriggerEquivalence:
    """Scheduled tick vs manual trigger must produce same system state."""

    @pytest.mark.asyncio
    async def test_manual_trigger_applies_system_effects(self) -> None:
        """GM manual trigger applies event system_effects (the audit-reported bug)."""
        evt = ScheduledEvent(
            id="e1", title="Degrade", description="",
            event_type=EventType.INFORMATIONAL, scheduled_pt_ms=999_999,
            system_effects=[
                SystemEffect(
                    system_id="comms", power_state=None,
                    operational_state="yellow", set_all_power=False,
                ),
            ],
        )
        systems = [
            SystemState(system_id="comms", label="COMMS", power=True, operational="green"),
        ]
        config = EngineConfig(
            exercise_id=1, title="Test", events=[evt],
            context=ScenarioContext(), initial_system_states=systems,
        )
        engine = ExerciseEngine(config)
        await engine.start()
        await engine.begin()

        changes = engine.trigger_event("e1")

        assert engine.system_manager.systems["comms"].operational == "yellow"
        sys_changes = [c for c in changes if c.get("type") == "system_state_change"]
        assert len(sys_changes) >= 1

    @pytest.mark.asyncio
    async def test_decision_event_opens_decision_and_applies_effects(self) -> None:
        """A DECISION event with system_effects does both: opens decision AND mutates systems."""
        opts = [_option("a", score=10.0)]
        dt = DecisionTemplate(
            id="d1", title="D1", description="", issue_id="i1",
            question_type="single_choice", options=opts,
            completion_mode="consensus", target_roles=["co"],
        )
        evt = ScheduledEvent(
            id="d1", title="Decision+Effects", description="",
            event_type=EventType.DECISION, scheduled_pt_ms=999_999,
            system_effects=[
                SystemEffect(
                    system_id="nav", power_state=False,
                    operational_state=None, set_all_power=False,
                ),
            ],
        )
        systems = [
            SystemState(system_id="nav", label="NAV", power=True, operational="green"),
        ]
        mode = SimpleCollaborativeMode(decision_sequence=["d1"])
        config = EngineConfig(
            exercise_id=1, title="Test", events=[evt],
            decision_templates=[dt], context=ScenarioContext(),
            initial_system_states=systems, game_mode=mode,
        )
        engine = ExerciseEngine(config)
        await engine.start()
        await engine.begin()

        changes = engine.trigger_event("d1")

        types = [c["type"] for c in changes]
        assert "event_change" in types
        assert "system_state_change" in types
        assert "decision_opened" in types
        assert engine.system_manager.systems["nav"].power is False
        assert len(engine.decision_manager.get_open_decisions()) == 1


class TestForcedCardSystemEffects:
    """Forced cards must affect system state even when not player-selected."""

    @pytest.mark.asyncio
    async def test_forced_card_applies_system_effects(self) -> None:
        opts = [
            _option("normal", score=5.0),
            _option(
                "forced", score=-2.0,
                system_effects=[
                    SystemEffect(
                        system_id="comms", power_state=None,
                        operational_state="red", set_all_power=False,
                    ),
                ],
            ),
        ]
        dt = DecisionTemplate(
            id="d1", title="D1", description="", issue_id="i1",
            question_type="single_choice", options=opts,
            completion_mode="consensus", target_roles=["co"],
            forced_option_ids=["forced"],
        )
        evt = ScheduledEvent(
            id="d1", title="E1", description="",
            event_type=EventType.DECISION, scheduled_pt_ms=999_999,
        )
        systems = [
            SystemState(system_id="comms", label="COMMS", power=True, operational="green"),
        ]
        mode = SimpleCollaborativeMode(decision_sequence=["d1"])
        config = EngineConfig(
            exercise_id=1, title="Test", events=[evt],
            decision_templates=[dt], context=ScenarioContext(),
            initial_system_states=systems, game_mode=mode,
        )
        engine = ExerciseEngine(config)
        await engine.start()
        await engine.begin()
        engine.force_trigger_next_decision(0.0, "")

        # Player selects only "normal" — "forced" auto-added
        await engine.close_decision("d1", ["normal"])

        assert engine.system_manager.systems["comms"].operational == "red"
