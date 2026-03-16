"""Tests for scenario content schema and loader."""
import pytest
from pydantic import ValidationError

from features.scenario.scenario_content import (
    DecisionOptionDef,
    DecisionTemplateDef,
    ScenarioContent,
    ScenarioEventDef,
    ScenarioIssueDef,
    ScenarioPhaseDef,
)
from features.scenario.scenario_loader import (
    build_engine_config,
    load_scenario_events,
    load_scenario_issues,
)
from engine.event_scheduler import EventType, ScheduledEvent
from engine.issue_manager import TriggerMode, TrackedIssue
from engine.exercise_engine import EngineConfig, ExerciseEngine


def _full_content() -> dict:
    """Return a complete scenario content dict for testing."""
    return {
        "phases": [
            {
                "id": "phase-1",
                "title": "Phase 1",
                "description": "Opening phase",
                "duration_ms": 600_000,
                "events": ["evt-1", "evt-2"],
            },
        ],
        "events": [
            {
                "id": "evt-1",
                "title": "Briefing",
                "description": "Initial briefing",
                "event_type": "informational",
                "scheduled_pt_ms": 0,
                "duration_ms": 60_000,
                "dependencies": [],
                "triggered_issues": ["iss-1"],
            },
            {
                "id": "evt-2",
                "title": "System Failure",
                "description": "Main system goes down",
                "event_type": "operational",
                "scheduled_pt_ms": 120_000,
                "duration_ms": None,
                "dependencies": ["evt-1"],
                "triggered_issues": [],
            },
        ],
        "issues": [
            {
                "id": "iss-1",
                "title": "Comms Down",
                "description": "Communications failure",
                "trigger_mode": "event-based",
                "trigger_event_id": "evt-1",
                "etbol_ms": 300_000,
            },
            {
                "id": "iss-2",
                "title": "Power Loss",
                "description": "Generator offline",
                "trigger_mode": "time-based",
                "trigger_time_pt_ms": 180_000,
                "etbol_ms": 0,
            },
        ],
        "decision_templates": [
            {
                "id": "dec-1",
                "title": "Evacuate?",
                "description": "Decide whether to evacuate",
                "issue_id": "iss-1",
                "question_type": "single_choice",
                "options": [
                    {"id": "opt-a", "label": "Yes", "score": 10.0},
                    {"id": "opt-b", "label": "No", "score": 0.0},
                ],
                "completion_mode": "first_response",
            },
        ],
        "default_time_factor": 2.0,
    }


# ── ScenarioContent validation ──────────────────────────────────────────


def test_scenario_content_validates_complete_json() -> None:
    content = ScenarioContent.model_validate(_full_content())
    assert len(content.events) == 2
    assert len(content.issues) == 2
    assert len(content.phases) == 1
    assert len(content.decision_templates) == 1
    assert content.default_time_factor == 2.0


def test_scenario_content_empty_defaults() -> None:
    content = ScenarioContent.model_validate({})
    assert content.phases == []
    assert content.events == []
    assert content.issues == []
    assert content.decision_templates == []
    assert content.default_time_factor == 1.0


def test_scenario_event_def_validation() -> None:
    evt = ScenarioEventDef.model_validate({
        "id": "e1",
        "title": "Test",
        "event_type": "decision",
        "scheduled_pt_ms": 5000,
    })
    assert evt.description == ""
    assert evt.duration_ms is None
    assert evt.dependencies == []
    assert evt.triggered_issues == []


def test_scenario_event_def_missing_required_fields() -> None:
    with pytest.raises(ValidationError):
        ScenarioEventDef.model_validate({"id": "e1"})


def test_scenario_issue_def_trigger_modes() -> None:
    time_issue = ScenarioIssueDef.model_validate({
        "id": "i1",
        "title": "Time Issue",
        "trigger_mode": "time-based",
        "trigger_time_pt_ms": 10_000,
    })
    assert time_issue.trigger_mode == "time-based"
    assert time_issue.trigger_time_pt_ms == 10_000

    event_issue = ScenarioIssueDef.model_validate({
        "id": "i2",
        "title": "Event Issue",
        "trigger_mode": "event-based",
        "trigger_event_id": "evt-1",
    })
    assert event_issue.trigger_mode == "event-based"
    assert event_issue.trigger_event_id == "evt-1"

    manual_issue = ScenarioIssueDef.model_validate({
        "id": "i3",
        "title": "Manual Issue",
        "trigger_mode": "manual",
    })
    assert manual_issue.trigger_mode == "manual"
    assert manual_issue.etbol_ms == 0


# ── Loader tests ─────────────────────────────────────────────────────────


def test_load_scenario_events_converts_all() -> None:
    content = ScenarioContent.model_validate(_full_content())
    events = load_scenario_events(content)
    assert len(events) == 2
    assert all(isinstance(e, ScheduledEvent) for e in events)

    briefing = next(e for e in events if e.id == "evt-1")
    assert briefing.title == "Briefing"
    assert briefing.event_type == EventType.INFORMATIONAL
    assert briefing.scheduled_pt_ms == 0
    assert briefing.duration_ms == 60_000
    assert briefing.triggered_issues == ["iss-1"]

    failure = next(e for e in events if e.id == "evt-2")
    assert failure.event_type == EventType.OPERATIONAL
    assert failure.dependencies == ["evt-1"]


def test_load_scenario_issues_converts_all() -> None:
    content = ScenarioContent.model_validate(_full_content())
    issues = load_scenario_issues(content)
    assert len(issues) == 2
    assert all(isinstance(i, TrackedIssue) for i in issues)

    comms = next(i for i in issues if i.id == "iss-1")
    assert comms.trigger_mode == TriggerMode.EVENT_BASED
    assert comms.trigger_event_id == "evt-1"
    assert comms.etbol_ms == 300_000

    power = next(i for i in issues if i.id == "iss-2")
    assert power.trigger_mode == TriggerMode.TIME_BASED
    assert power.trigger_time_pt_ms == 180_000


def test_build_engine_config_produces_valid_config() -> None:
    content = ScenarioContent.model_validate(_full_content())
    config = build_engine_config(exercise_id=42, title="Test Ex", content=content)
    assert isinstance(config, EngineConfig)
    assert config.exercise_id == 42
    assert config.title == "Test Ex"
    assert config.time_factor == 2.0
    assert len(config.events) == 2
    assert len(config.issues) == 2


def test_round_trip_content_to_engine() -> None:
    """Create content, build config, verify engine can start."""
    content = ScenarioContent.model_validate(_full_content())
    config = build_engine_config(exercise_id=1, title="Round Trip", content=content)
    engine = ExerciseEngine(config)
    snap = engine.snapshot()
    assert snap["exercise_id"] == 1
    assert len(snap["events"]) == 2
    assert len(snap["issues"]) == 2
    assert snap["phase"] == "setup"
