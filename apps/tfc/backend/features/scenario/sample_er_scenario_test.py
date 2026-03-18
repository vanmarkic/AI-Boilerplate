"""Tests for the Emergency Response sample scenario."""

from __future__ import annotations

from engine.event_scheduler import EventType
from engine.exercise_engine import EngineConfig, ExerciseEngine
from engine.issue_manager import TriggerMode
from features.scenario.sample_er_scenario import ER_SCENARIO_CONTENT
from features.scenario.scenario_content import ScenarioContent
from features.scenario.scenario_loader import (
    build_engine_config,
    load_decision_templates,
    load_scenario_events,
    load_scenario_issues,
)


def _content() -> ScenarioContent:
    return ScenarioContent.model_validate(ER_SCENARIO_CONTENT)


# ── Schema validation ───────────────────────────────────────────────────


def test_er_scenario_validates_against_schema() -> None:
    content = _content()
    assert len(content.phases) == 4
    assert len(content.events) == 11
    assert len(content.issues) == 7
    assert len(content.decision_templates) == 5
    assert content.default_time_factor == 1.5
    assert content.briefing != ""
    assert len(content.objectives) == 5
    assert len(content.rules) == 3
    assert content.game_mode == "simple_collaborative"
    assert len(content.decision_sequence) == 5


def test_er_scenario_has_roles() -> None:
    content = _content()
    assert len(content.roles) == 7
    role_ids = {r.id for r in content.roles}
    assert role_ids == {"co", "ops", "nav", "pwo", "aawo", "cyop", "eo"}


def test_er_scenario_roles_have_valid_player_types() -> None:
    content = _content()
    valid_types = {"advisor", "decision_maker"}
    for role in content.roles:
        assert role.player_type in valid_types, f"Role {role.id} has invalid player_type"


def test_er_scenario_has_exactly_one_decision_maker() -> None:
    content = _content()
    decision_makers = [r for r in content.roles if r.player_type == "decision_maker"]
    assert len(decision_makers) == 1
    assert decision_makers[0].id == "co"


# ── Event loading ────────────────────────────────────────────────────────


def test_er_events_load_with_correct_types() -> None:
    events = load_scenario_events(_content())
    assert len(events) == 11

    dispatch = next(e for e in events if e.id == "evt-dispatch")
    assert dispatch.event_type == EventType.INFORMATIONAL
    assert dispatch.scheduled_pt_ms == 0

    mci = next(e for e in events if e.id == "evt-mci-activation")
    assert mci.event_type == EventType.DECISION
    assert "evt-dispatch" in mci.dependencies

    blood = next(e for e in events if e.id == "evt-blood-shortage")
    assert blood.event_type == EventType.DECISION
    assert "iss-blood-supply" in blood.triggered_issues


def test_er_events_are_chronologically_ordered() -> None:
    events = load_scenario_events(_content())
    times = [e.scheduled_pt_ms for e in events]
    assert times == sorted(times)


# ── Issue loading ────────────────────────────────────────────────────────


def test_er_issues_load_with_correct_triggers() -> None:
    issues = load_scenario_issues(_content())
    assert len(issues) == 7

    event_based = [i for i in issues if i.trigger_mode == TriggerMode.EVENT_BASED]
    time_based = [i for i in issues if i.trigger_mode == TriggerMode.TIME_BASED]
    assert len(event_based) == 6
    assert len(time_based) == 1

    pio = next(i for i in issues if i.id == "iss-public-info")
    assert pio.trigger_mode == TriggerMode.TIME_BASED
    assert pio.trigger_time_pt_ms == 28 * 60_000


# ── Decision templates ───────────────────────────────────────────────────


def test_er_decisions_load_correctly() -> None:
    templates = load_decision_templates(_content())
    assert len(templates) == 5

    mci_level = next(t for t in templates if t.id == "dec-mci-level")
    assert len(mci_level.options) == 2
    assert mci_level.question_type == "single_choice"

    or_priority = next(t for t in templates if t.id == "dec-or-priority")
    assert len(or_priority.options) == 3


# ── Full engine round-trip ───────────────────────────────────────────────


def test_er_scenario_round_trip_to_engine() -> None:
    content = _content()
    config = build_engine_config(
        exercise_id=100,
        title="Hospital MCI Exercise",
        content=content,
    )
    assert isinstance(config, EngineConfig)
    assert config.exercise_id == 100
    assert config.time_factor == 1.5
    assert len(config.events) == 11
    assert len(config.issues) == 7
    assert len(config.decision_templates) == 5

    engine = ExerciseEngine(config)
    snap = engine.snapshot()
    assert snap["exercise_id"] == 100
    assert snap["phase"] == "setup"
    assert len(snap["events"]) == 11
    assert len(snap["issues"]) == 7


def test_er_scenario_all_issue_refs_valid() -> None:
    """Every triggered_issues ref in events points to a real issue."""
    content = _content()
    issue_ids = {iss.id for iss in content.issues}
    for evt in content.events:
        for ref in evt.triggered_issues:
            assert ref in issue_ids, f"Event {evt.id} references unknown issue {ref}"


def test_er_scenario_all_dependency_refs_valid() -> None:
    """Every dependency ref in events points to a real event."""
    content = _content()
    event_ids = {evt.id for evt in content.events}
    for evt in content.events:
        for dep in evt.dependencies:
            assert dep in event_ids, f"Event {evt.id} depends on unknown event {dep}"


def test_er_scenario_all_decision_issue_refs_valid() -> None:
    """Every decision template references a real issue."""
    content = _content()
    issue_ids = {iss.id for iss in content.issues}
    for dt in content.decision_templates:
        assert dt.issue_id in issue_ids, f"Decision {dt.id} references unknown issue {dt.issue_id}"


def test_er_scenario_phase_event_refs_valid() -> None:
    """Every event listed in a phase exists in the events list."""
    content = _content()
    event_ids = {evt.id for evt in content.events}
    for phase in content.phases:
        for ref in phase.events:
            assert ref in event_ids, f"Phase {phase.id} references unknown event {ref}"
