"""Tests for scenario content schema and loader."""
import pytest
from pydantic import ValidationError

from features.scenario.scenario_content import (
    DecisionOptionDef,
    DecisionTemplateDef,
    ScenarioContent,
    ScenarioInjectDef,
    ScenarioDefectDef,
    ScenarioPhaseDef,
)
from features.scenario.scenario_loader import (
    build_engine_config,
    load_scenario_injects,
    load_scenario_defects,
)
from engine.inject_scheduler import InjectType, ScheduledInject
from engine.defect_manager import TriggerMode, TrackedDefect
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
                "injects": ["evt-1", "evt-2"],
            },
        ],
        "injects": [
            {
                "id": "evt-1",
                "title": "Briefing",
                "description": "Initial briefing",
                "inject_type": "informational",
                "scheduled_pt_ms": 0,
                "duration_ms": 60_000,
                "dependencies": [],
                "triggered_defects": ["iss-1"],
            },
            {
                "id": "evt-2",
                "title": "System Failure",
                "description": "Main system goes down",
                "inject_type": "operational",
                "scheduled_pt_ms": 120_000,
                "duration_ms": None,
                "dependencies": ["evt-1"],
                "triggered_defects": [],
            },
        ],
        "defects": [
            {
                "id": "iss-1",
                "title": "Comms Down",
                "description": "Communications failure",
                "trigger_mode": "inject-based",
                "trigger_inject_id": "evt-1",
                "auto_resolve_pt_ms": 300_000,
            },
            {
                "id": "iss-2",
                "title": "Power Loss",
                "description": "Generator offline",
                "trigger_mode": "time-based",
                "trigger_time_pt_ms": 180_000,
                "auto_resolve_pt_ms": 0,
            },
        ],
        "decision_templates": [
            {
                "id": "dec-1",
                "title": "Evacuate?",
                "description": "Decide whether to evacuate",
                "defect_id": "iss-1",
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
    assert len(content.injects) == 2
    assert len(content.defects) == 2
    assert len(content.phases) == 1
    assert len(content.decision_templates) == 1
    assert content.default_time_factor == 2.0


def test_scenario_content_empty_defaults() -> None:
    content = ScenarioContent.model_validate({})
    assert content.phases == []
    assert content.injects == []
    assert content.defects == []
    assert content.decision_templates == []
    assert content.default_time_factor == 1.0


def test_scenario_inject_def_validation() -> None:
    inj = ScenarioInjectDef.model_validate({
        "id": "e1",
        "title": "Test",
        "inject_type": "decision",
        "scheduled_pt_ms": 5000,
    })
    assert inj.description == ""
    assert inj.duration_ms is None
    assert inj.dependencies == []
    assert inj.triggered_defects == []


def test_scenario_inject_def_missing_required_fields() -> None:
    with pytest.raises(ValidationError):
        ScenarioInjectDef.model_validate({"id": "e1"})


def test_scenario_defect_def_trigger_modes() -> None:
    time_defect = ScenarioDefectDef.model_validate({
        "id": "i1",
        "title": "Time Defect",
        "trigger_mode": "time-based",
        "trigger_time_pt_ms": 10_000,
    })
    assert time_defect.trigger_mode == "time-based"
    assert time_defect.trigger_time_pt_ms == 10_000

    inject_defect = ScenarioDefectDef.model_validate({
        "id": "i2",
        "title": "Inject Defect",
        "trigger_mode": "inject-based",
        "trigger_inject_id": "evt-1",
    })
    assert inject_defect.trigger_mode == "inject-based"
    assert inject_defect.trigger_inject_id == "evt-1"

    manual_defect = ScenarioDefectDef.model_validate({
        "id": "i3",
        "title": "Manual Defect",
        "trigger_mode": "manual",
    })
    assert manual_defect.trigger_mode == "manual"
    assert manual_defect.auto_resolve_pt_ms == 0


# ── Loader tests ─────────────────────────────────────────────────────────


def test_load_scenario_injects_converts_all() -> None:
    content = ScenarioContent.model_validate(_full_content())
    injects = load_scenario_injects(content)
    assert len(injects) == 2
    assert all(isinstance(e, ScheduledInject) for e in injects)

    briefing = next(e for e in injects if e.id == "evt-1")
    assert briefing.title == "Briefing"
    assert briefing.inject_type == InjectType.INFORMATIONAL
    assert briefing.scheduled_pt_ms == 0
    assert briefing.duration_ms == 60_000
    assert briefing.triggered_defects == ["iss-1"]

    failure = next(e for e in injects if e.id == "evt-2")
    assert failure.inject_type == InjectType.OPERATIONAL
    assert failure.dependencies == ["evt-1"]


def test_load_scenario_defects_converts_all() -> None:
    content = ScenarioContent.model_validate(_full_content())
    defects = load_scenario_defects(content)
    assert len(defects) == 2
    assert all(isinstance(i, TrackedDefect) for i in defects)

    comms = next(i for i in defects if i.id == "iss-1")
    assert comms.trigger_mode == TriggerMode.INJECT_BASED
    assert comms.trigger_inject_id == "evt-1"
    assert comms.auto_resolve_pt_ms == 300_000

    power = next(i for i in defects if i.id == "iss-2")
    assert power.trigger_mode == TriggerMode.TIME_BASED
    assert power.trigger_time_pt_ms == 180_000


def test_build_engine_config_produces_valid_config() -> None:
    content = ScenarioContent.model_validate(_full_content())
    config = build_engine_config(exercise_id=42, title="Test Ex", content=content)
    assert isinstance(config, EngineConfig)
    assert config.exercise_id == 42
    assert config.title == "Test Ex"
    assert config.time_factor == 2.0
    assert len(config.injects) == 2
    assert len(config.defects) == 2


def test_round_trip_content_to_engine() -> None:
    """Create content, build config, verify engine can start."""
    content = ScenarioContent.model_validate(_full_content())
    config = build_engine_config(exercise_id=1, title="Round Trip", content=content)
    engine = ExerciseEngine(config)
    snap = engine.snapshot()
    assert snap["exercise_id"] == 1
    assert len(snap["injects"]) == 2
    assert len(snap["defects"]) == 2
    assert snap["phase"] == "setup"


# ── Referential integrity validation ─────────────────────────────────────


def test_validate_valid_scenario_returns_no_errors() -> None:
    content = ScenarioContent.model_validate(_full_content())
    errors = content.validate()
    assert errors == []


def test_validate_invalid_inject_dependency() -> None:
    data = _full_content()
    # evt-2 depends on "evt-1" which exists; add a bad dependency
    data["injects"][1]["dependencies"] = ["evt-1", "evt-nonexistent"]
    content = ScenarioContent.model_validate(data)
    errors = content.validate()
    assert any("evt-nonexistent" in e for e in errors)
    assert len(errors) == 1


def test_validate_invalid_triggered_defect() -> None:
    data = _full_content()
    data["injects"][0]["triggered_defects"] = ["iss-1", "iss-does-not-exist"]
    content = ScenarioContent.model_validate(data)
    errors = content.validate()
    assert any("iss-does-not-exist" in e for e in errors)
    assert len(errors) == 1


def test_validate_invalid_trigger_inject_id() -> None:
    data = _full_content()
    data["defects"][0]["trigger_inject_id"] = "evt-ghost"
    content = ScenarioContent.model_validate(data)
    errors = content.validate()
    assert any("evt-ghost" in e for e in errors)
    assert len(errors) == 1


def test_validate_invalid_decision_defect_id() -> None:
    data = _full_content()
    data["decision_templates"][0]["defect_id"] = "iss-ghost"
    content = ScenarioContent.model_validate(data)
    errors = content.validate()
    assert any("iss-ghost" in e for e in errors)
    assert len(errors) == 1


def test_validate_multiple_errors_returned() -> None:
    data = _full_content()
    data["injects"][0]["triggered_defects"] = ["iss-bad-1", "iss-bad-2"]
    data["decision_templates"][0]["defect_id"] = "iss-also-bad"
    content = ScenarioContent.model_validate(data)
    errors = content.validate()
    assert len(errors) == 3
