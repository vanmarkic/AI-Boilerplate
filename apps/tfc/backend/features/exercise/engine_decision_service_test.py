"""Tests for EngineDecisionService — player-close path system effects.

Verifies that system effects from selected decision options are applied
and broadcast when a player closes a decision (not just on timeout).
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from engine.engine_config import DecisionTemplate, EngineConfig, ScenarioContext
from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import ExerciseEngine
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
