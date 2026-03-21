"""Tests for EngineDecisionService — player-close path system effects.

Verifies that system effects from selected decision options are applied
and broadcast when a player closes a decision (not just on timeout).
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from engine.engine_config import DecisionTemplate, EngineConfig, ScenarioContext
from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import EnginePhase, ExerciseEngine
from engine.game_modes.simple_collaborative import SimpleCollaborativeMode
from engine.state_changes import DecisionOptionSnapshot, SystemEffect
from engine.system_manager import SystemState
from features.exercise.engine_decision_service import EngineDecisionService


def _option(
    id: str,
    *,
    score: float = 0.0,
    system_effects: list[SystemEffect] | None = None,
) -> DecisionOptionSnapshot:
    return DecisionOptionSnapshot(
        id=id,
        label=f"Option {id}",
        score=score,
        stress_delta=0,
        system_effects=system_effects or [],
        targets_system=False,
        max_plays=1,
        role=None,
    )


def _build_engine(
    options: list[DecisionOptionSnapshot],
    initial_systems: list[SystemState] | None = None,
) -> ExerciseEngine:
    """Build an engine with a single decision template and open that decision."""
    dt = DecisionTemplate(
        id="d1",
        title="Test Decision",
        description="Pick one",
        issue_id="i1",
        question_type="single_choice",
        options=options,
        completion_mode="first_response",
        timeout_ms=60_000.0,
    )
    evt = ScheduledEvent(
        id="d1",
        title="DE-d1",
        description="Decision event",
        event_type=EventType.DECISION,
        scheduled_pt_ms=0.0,
    )
    mode = SimpleCollaborativeMode(decision_sequence=["d1"])
    config = EngineConfig(
        exercise_id=1,
        title="Test",
        events=[evt],
        decision_templates=[dt],
        context=ScenarioContext(),
        initial_system_states=initial_systems or [],
        game_mode=mode,
    )
    engine = ExerciseEngine(config)
    # Open the decision manually so close_decision can find it
    engine.decision_manager.open_decision(
        id="d1",
        event_id=None,
        issue_id="i1",
        title="Test Decision",
        description="Pick one",
        question_type="single_choice",
        options=options,
        completion_mode="first_response",
        target_roles=[],
        timeout_ms=60_000,
        max_selections=None,
        current_pt_ms=0.0,
    )
    return engine


class TestCloseDecisionSystemEffects:
    """Player-close path must apply system effects from selected options."""

    @pytest.mark.asyncio
    async def test_system_effects_applied_on_player_close(self) -> None:
        """Selecting an option with system_effects updates SystemManager state."""
        systems = [SystemState(system_id="nav", label="NAV", power=True, operational="green")]
        options = [
            _option(
                "o-shutdown",
                score=1.0,
                system_effects=[
                    SystemEffect(system_id="nav", power_state=False, operational_state="red"),
                ],
            ),
            _option("o-keep", score=0.0),
        ]
        engine = _build_engine(options, initial_systems=systems)
        broadcast = AsyncMock()
        service = EngineDecisionService()

        await service.close_decision(
            engine=engine,
            decision_id="d1",
            selected_option_ids=["o-shutdown"],
            broadcast=broadcast,
        )

        # System state must have changed
        assert engine.system_manager.systems["nav"].power is False
        assert engine.system_manager.systems["nav"].operational == "red"

    @pytest.mark.asyncio
    async def test_system_effects_broadcast_on_player_close(self) -> None:
        """System state changes must be included in the broadcast."""
        systems = [SystemState(system_id="nav", label="NAV", power=True, operational="green")]
        options = [
            _option(
                "o-shutdown",
                score=1.0,
                system_effects=[
                    SystemEffect(system_id="nav", power_state=None, operational_state="red"),
                ],
            ),
            _option("o-keep", score=0.0),
        ]
        engine = _build_engine(options, initial_systems=systems)
        broadcast = AsyncMock()
        service = EngineDecisionService()

        await service.close_decision(
            engine=engine,
            decision_id="d1",
            selected_option_ids=["o-shutdown"],
            broadcast=broadcast,
        )

        # Collect all broadcast state changes
        all_changes: list[dict] = []
        for call in broadcast.call_args_list:
            all_changes.extend(call[0][0])
        sys_changes = [c for c in all_changes if c.get("type") == "system_state_change"]
        assert len(sys_changes) >= 1
        assert sys_changes[0]["system_id"] == "nav"
        assert sys_changes[0]["operational"] == "red"

    @pytest.mark.asyncio
    async def test_no_system_effects_no_extra_broadcast(self) -> None:
        """Options without system_effects should not produce system state changes."""
        options = [
            _option("o1", score=1.0),
            _option("o2", score=0.0),
        ]
        engine = _build_engine(options)
        broadcast = AsyncMock()
        service = EngineDecisionService()

        await service.close_decision(
            engine=engine,
            decision_id="d1",
            selected_option_ids=["o1"],
            broadcast=broadcast,
        )

        all_changes: list[dict] = []
        for call in broadcast.call_args_list:
            all_changes.extend(call[0][0])
        sys_changes = [c for c in all_changes if c.get("type") == "system_state_change"]
        assert sys_changes == []


class TestAutoCompleteOnSequenceExhausted:
    """Exercise auto-completes when the last decision in the sequence is closed."""

    @staticmethod
    def _two_turn_engine() -> ExerciseEngine:
        """Build an engine with 2-turn decision sequence."""
        opts_t1 = [_option("opt-a", score=10.0)]
        opts_t2 = [_option("opt-b", score=10.0)]
        dt1 = DecisionTemplate(
            id="evt-t1",
            title="T1",
            description="",
            issue_id="i1",
            question_type="multi_choice",
            options=opts_t1,
            completion_mode="consensus",
            target_roles=["co"],
            max_selections=1,
        )
        dt2 = DecisionTemplate(
            id="evt-t2",
            title="T2",
            description="",
            issue_id="i2",
            question_type="multi_choice",
            options=opts_t2,
            completion_mode="consensus",
            target_roles=["co"],
            max_selections=1,
        )
        evt1 = ScheduledEvent(
            id="evt-t1",
            title="Turn 1",
            description="",
            event_type=EventType.DECISION,
            scheduled_pt_ms=0.0,
        )
        evt2 = ScheduledEvent(
            id="evt-t2",
            title="Turn 2",
            description="",
            event_type=EventType.DECISION,
            scheduled_pt_ms=300_000.0,
            dependencies=["evt-t1"],
        )
        mode = SimpleCollaborativeMode(
            decision_sequence=["evt-t1", "evt-t2"],
            base_decision_time_ms=300_000,
        )
        config = EngineConfig(
            exercise_id=1,
            title="Test 2T",
            events=[evt1, evt2],
            decision_templates=[dt1, dt2],
            context=ScenarioContext(),
            game_mode=mode,
        )
        return ExerciseEngine(config)

    @pytest.mark.asyncio
    async def test_auto_completes_after_last_decision(self) -> None:
        """Closing the last decision triggers engine.complete() and broadcasts phase_change."""
        engine = self._two_turn_engine()
        await engine.start()
        await engine.begin()

        pt = engine.time_manager.play_time_ms
        engine.force_trigger_next_decision(pt)

        assert engine.phase == EnginePhase.RUNNING

        broadcast_log: list[dict] = []

        async def fake_broadcast(changes: list) -> None:
            broadcast_log.extend(changes)

        svc = EngineDecisionService()

        # Close Turn 1 → should advance to Turn 2
        await svc.close_decision(engine, "evt-t1", ["opt-a"], broadcast=fake_broadcast)
        assert engine.phase == EnginePhase.RUNNING

        # Close Turn 2 (last) → should auto-complete
        await svc.close_decision(engine, "evt-t2", ["opt-b"], broadcast=fake_broadcast)
        assert engine.phase == EnginePhase.COMPLETED

        # Verify a phase_change "completed" was broadcast
        phase_changes = [c for c in broadcast_log if c.get("type") == "phase_change"]
        completed = [c for c in phase_changes if c.get("phase") == "completed"]
        assert len(completed) == 1

    @pytest.mark.asyncio
    async def test_does_not_complete_when_decisions_remain(self) -> None:
        """Closing a non-final decision does NOT trigger completion."""
        engine = self._two_turn_engine()
        await engine.start()
        await engine.begin()

        pt = engine.time_manager.play_time_ms
        engine.force_trigger_next_decision(pt)

        broadcast_log: list[dict] = []

        async def fake_broadcast(changes: list) -> None:
            broadcast_log.extend(changes)

        svc = EngineDecisionService()
        await svc.close_decision(engine, "evt-t1", ["opt-a"], broadcast=fake_broadcast)

        assert engine.phase == EnginePhase.RUNNING
        phase_changes = [c for c in broadcast_log if c.get("type") == "phase_change"]
        completed = [c for c in phase_changes if c.get("phase") == "completed"]
        assert len(completed) == 0
