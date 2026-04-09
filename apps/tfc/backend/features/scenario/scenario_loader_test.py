"""Tests for scenario_loader — converting ScenarioContent to EngineConfig."""
from __future__ import annotations

from features.scenario.scenario_content import (
    DecisionOptionDef,
    DecisionTemplateDef,
    ScenarioContent,
    ScenarioInjectDef,
)
from features.scenario.scenario_loader import (
    build_engine_config,
    load_decision_templates,
)


def _minimal_content(**overrides: object) -> ScenarioContent:
    """Create a minimal ScenarioContent with optional overrides."""
    defaults: dict = {
        "injects": [],
        "defects": [],
        "phases": [],
        "decision_templates": [],
        "default_time_factor": 1.0,
    }
    defaults.update(overrides)
    return ScenarioContent(**defaults)


def test_build_engine_config_loads_decision_templates() -> None:
    dt = DecisionTemplateDef(
        id="dt1",
        title="Evacuate?",
        description="Should we evacuate?",
        defect_id="i1",
        question_type="single_choice",
        options=[
            DecisionOptionDef(id="o1", label="Yes", score=1.0),
            DecisionOptionDef(id="o2", label="No", score=0.0),
        ],
        completion_mode="first_response",
    )
    content = _minimal_content(decision_templates=[dt])
    config = build_engine_config(exercise_id=1, title="Test", content=content)

    assert len(config.decision_templates) == 1
    tmpl = config.decision_templates[0]
    assert tmpl.id == "dt1"
    assert tmpl.title == "Evacuate?"
    assert tmpl.defect_id == "i1"
    assert tmpl.question_type == "single_choice"
    assert len(tmpl.options) == 2
    assert tmpl.options[0] == {"id": "o1", "label": "Yes", "score": 1.0}
    assert tmpl.completion_mode == "first_response"


def test_build_engine_config_loads_context() -> None:
    content = _minimal_content(
        briefing="Emergency briefing text",
        objectives=["Save lives", "Minimize damage"],
        rules=["No running", "Follow protocol"],
    )
    # Also add a title/description via a scenario inject for the title
    config = build_engine_config(
        exercise_id=2, title="Scenario Title", content=content,
    )

    assert config.context.title == "Scenario Title"
    assert config.context.briefing == "Emergency briefing text"
    assert config.context.objectives == ["Save lives", "Minimize damage"]
    assert config.context.rules == ["No running", "Follow protocol"]


def test_load_decision_templates_empty() -> None:
    content = _minimal_content()
    result = load_decision_templates(content)
    assert result == []


def test_load_decision_templates_preserves_target_roles() -> None:
    dt = DecisionTemplateDef(
        id="dt2",
        title="Deploy team?",
        description="Deploy response team",
        defect_id="i2",
        question_type="multi_choice",
        options=[],
        completion_mode="all_respond",
    )
    content = _minimal_content(decision_templates=[dt])
    result = load_decision_templates(content)
    assert len(result) == 1
    assert result[0].target_roles == []
