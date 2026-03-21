"""Property tests — poka-yoke guards for decision opening via event triggers.

Bug context: _handle_decision_events only matched action=="started", missing
"force_triggered" from manual event triggers. This caused decisions to never
open when a GM or practice-mode auto-advance triggered events.

These tests ensure decisions open for ALL event-start actions, regardless of
how the event was triggered.
"""

from __future__ import annotations

import asyncio

from hypothesis import given, settings
from hypothesis import strategies as st

from engine.decision_manager import DecisionManager
from engine.engine_config import DecisionTemplate, EngineConfig, RoleInfo, ScenarioContext
from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import ExerciseEngine
from engine.game_modes.simple_collaborative import SimpleCollaborativeMode
from engine.strategies import option_lists, play_times


@st.composite
def decision_event_changes(draw: st.DrawFn) -> tuple[dict, str]:
    """Generate an event_change dict with a decision-triggering action."""
    event_id = f"evt-{draw(st.integers(min_value=0, max_value=99))}"
    action = draw(st.sampled_from(["started", "force_triggered"]))
    change = {
        "type": "event_change",
        "event_id": event_id,
        "action": action,
        "lifecycle": "running",
        "title": f"Event {event_id}",
        "target_roles": [],
        "role_descriptions": {},
    }
    return change, event_id


@st.composite
def non_decision_actions(draw: st.DrawFn) -> str:
    """Actions that must NOT open decisions."""
    return draw(st.sampled_from([
        "activated", "completed", "cancelled", "paused",
        "resumed", "delayed", "skipped",
    ]))


class TestForceTriggeredOpenDecisions:
    """Any event with action in {started, force_triggered} must open a decision
    if the event type is DECISION and a template exists."""

    @given(
        action=st.sampled_from(["started", "force_triggered"]),
        pt=play_times(),
        options=option_lists(min_size=1, max_size=4),
    )
    @settings(max_examples=200)
    def test_decision_type_event_always_opens_decision(
        self,
        action: str,
        pt: float,
        options: list[dict],
    ) -> None:
        event_id = "evt-test"
        mode = SimpleCollaborativeMode(
            decision_sequence=[event_id],
            base_decision_time_ms=300000,
        )
        config = EngineConfig(
            exercise_id=1,
            title="Test",
            events=[
                ScheduledEvent(
                    id=event_id,
                    title="Test Event",
                    description="d",
                    event_type=EventType.DECISION,
                    scheduled_pt_ms=999999,
                ),
            ],
            decision_templates=[
                DecisionTemplate(
                    id=event_id,
                    issue_id="iss-1",
                    title="Decision",
                    description="d",
                    question_type="multi_choice",
                    options=options,
                    completion_mode="consensus",
                    target_roles=["co"],
                    timeout_ms=0,
                    max_selections=2,
                ),
            ],
            game_mode=mode,
            context=ScenarioContext(title="T"),
        )

        engine = ExerciseEngine(config)
        change = {
            "type": "event_change",
            "event_id": event_id,
            "action": action,
            "lifecycle": "running",
            "title": "Test Event",
            "target_roles": [],
            "role_descriptions": {},
        }
        # Manually set event to running so the engine finds it
        engine.event_scheduler.events[event_id].lifecycle = "running"  # type: ignore[assignment]

        # Run with an event loop since game-mode timeout fallback starts a monitor task
        async def _run() -> None:
            decision_changes = engine._handle_decision_events([change], pt)
            assert len(decision_changes) == 1, (
                f"action={action!r} must open a decision for DECISION events"
            )
            assert decision_changes[0]["type"] == "decision_opened"
            engine._stop_timeout_monitor()

        asyncio.run(_run())

    @given(action=non_decision_actions(), pt=play_times())
    @settings(max_examples=200)
    def test_non_start_actions_never_open_decisions(
        self,
        action: str,
        pt: float,
    ) -> None:
        event_id = "evt-test"
        mode = SimpleCollaborativeMode(
            decision_sequence=[event_id],
            base_decision_time_ms=300000,
        )
        opt = {"id": "a", "label": "A", "score": 10, "stress_delta": 0,
               "system_effects": [], "targets_system": False, "max_plays": 1, "role": None}
        config = EngineConfig(
            exercise_id=1,
            title="Test",
            events=[
                ScheduledEvent(
                    id=event_id,
                    title="Test Event",
                    description="d",
                    event_type=EventType.DECISION,
                    scheduled_pt_ms=0,
                ),
            ],
            decision_templates=[
                DecisionTemplate(
                    id=event_id,
                    issue_id="iss-1",
                    title="Dec",
                    description="d",
                    question_type="multi_choice",
                    options=[opt],
                    completion_mode="consensus",
                    target_roles=[],
                    timeout_ms=0,
                    max_selections=1,
                ),
            ],
            game_mode=mode,
            context=ScenarioContext(title="T"),
        )

        engine = ExerciseEngine(config)
        change = {
            "type": "event_change",
            "event_id": event_id,
            "action": action,
            "lifecycle": "running",
            "title": "Test Event",
            "target_roles": [],
            "role_descriptions": {},
        }

        decision_changes = engine._handle_decision_events([change], pt)

        assert len(decision_changes) == 0, (
            f"action={action!r} must NOT open decisions"
        )

    @given(
        action=st.sampled_from(["started", "force_triggered"]),
        event_type=st.sampled_from([EventType.INFORMATIONAL, EventType.OPERATIONAL]),
        pt=play_times(),
    )
    @settings(max_examples=200)
    def test_non_decision_events_never_open_decisions(
        self,
        action: str,
        event_type: EventType,
        pt: float,
    ) -> None:
        event_id = "evt-test"
        mode = SimpleCollaborativeMode(
            decision_sequence=[],
            base_decision_time_ms=300000,
        )
        config = EngineConfig(
            exercise_id=1,
            title="Test",
            events=[
                ScheduledEvent(
                    id=event_id,
                    title="Test Event",
                    description="d",
                    event_type=event_type,
                    scheduled_pt_ms=0,
                ),
            ],
            game_mode=mode,
            context=ScenarioContext(title="T"),
        )

        engine = ExerciseEngine(config)
        engine.event_scheduler.events[event_id].lifecycle = "running"  # type: ignore[assignment]
        change = {
            "type": "event_change",
            "event_id": event_id,
            "action": action,
            "lifecycle": "running",
            "title": "Test Event",
            "target_roles": [],
            "role_descriptions": {},
        }

        decision_changes = engine._handle_decision_events([change], pt)

        assert len(decision_changes) == 0, (
            f"Non-DECISION event type {event_type} must not open decisions"
        )
