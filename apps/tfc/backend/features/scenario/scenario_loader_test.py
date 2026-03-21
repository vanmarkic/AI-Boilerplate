"""Tests for scenario_loader — converting ScenarioContent to EngineConfig."""

from __future__ import annotations

from features.scenario.scenario_content import (
    DecisionOptionDef,
    DecisionTemplateDef,
    ScenarioContent,
    SystemEffectDef,
)
from features.scenario.scenario_loader import (
    _compute_max_possible_score,
    build_engine_config,
    load_decision_templates,
)


def _minimal_content(**overrides: object) -> ScenarioContent:
    """Create a minimal ScenarioContent with optional overrides."""
    defaults: dict = {
        "events": [],
        "issues": [],
        "phases": [],
        "decision_templates": [],
        "default_time_factor": 1.0,
        "roles": [{"id": "co", "label": "CO", "player_type": "decision_maker"}],
    }
    defaults.update(overrides)
    return ScenarioContent(**defaults)


def test_build_engine_config_loads_decision_templates() -> None:
    dt = DecisionTemplateDef(
        id="dt1",
        title="Evacuate?",
        description="Should we evacuate?",
        issue_id="i1",
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
    assert tmpl.issue_id == "i1"
    assert tmpl.question_type == "single_choice"
    assert len(tmpl.options) == 2
    assert tmpl.options[0] == {
        "id": "o1",
        "label": "Yes",
        "score": 1.0,
        "stress_delta": 0,
        "system_effects": [],
        "targets_system": False,
        "max_plays": 1,
        "role": None,
    }
    assert tmpl.completion_mode == "first_response"


def test_build_engine_config_loads_context() -> None:
    content = _minimal_content(
        briefing="Emergency briefing text",
        objectives=["Save lives", "Minimize damage"],
        rules=["No running", "Follow protocol"],
    )
    # Also add a title/description via a scenario event for the title
    config = build_engine_config(
        exercise_id=2,
        title="Scenario Title",
        content=content,
    )

    assert config.context.title == "Scenario Title"
    assert config.context.briefing == "Emergency briefing text"
    assert config.context.objectives == ["Save lives", "Minimize damage"]
    assert config.context.rules == ["No running", "Follow protocol"]


def test_load_decision_templates_empty() -> None:
    content = _minimal_content()
    result = load_decision_templates(content)
    assert result == []


def test_load_decision_templates_preserves_max_selections() -> None:
    dt = DecisionTemplateDef(
        id="dt-max",
        title="Pick 2",
        description="Select up to 2",
        issue_id="i1",
        question_type="multi_choice",
        options=[
            DecisionOptionDef(id="o1", label="A", score=1.0),
            DecisionOptionDef(id="o2", label="B", score=2.0),
            DecisionOptionDef(id="o3", label="C", score=3.0),
        ],
        completion_mode="consensus",
        max_selections=2,
    )
    content = _minimal_content(decision_templates=[dt])
    result = load_decision_templates(content)
    assert len(result) == 1
    assert result[0].max_selections == 2


def test_load_decision_templates_max_selections_defaults_none() -> None:
    dt = DecisionTemplateDef(
        id="dt-nomax",
        title="Pick any",
        description="No limit",
        issue_id="i1",
        question_type="multi_choice",
        options=[],
        completion_mode="first_response",
    )
    content = _minimal_content(decision_templates=[dt])
    result = load_decision_templates(content)
    assert result[0].max_selections is None


def test_load_decision_templates_preserves_target_roles() -> None:
    dt = DecisionTemplateDef(
        id="dt2",
        title="Deploy team?",
        description="Deploy response team",
        issue_id="i2",
        question_type="multi_choice",
        options=[],
        completion_mode="all_respond",
    )
    content = _minimal_content(decision_templates=[dt])
    result = load_decision_templates(content)
    assert len(result) == 1
    assert result[0].target_roles == []


def test_build_engine_config_propagates_system_effects_round_trip() -> None:
    """Round-trip: system_effects, targets_system, max_plays survive loader."""
    dt = DecisionTemplateDef(
        id="dt-sys",
        title="Power down radar?",
        description="Shut down the radar system",
        issue_id="i-radar",
        question_type="single_choice",
        options=[
            DecisionOptionDef(
                id="o-yes",
                label="Shut down",
                score=0.5,
                system_effects=[
                    SystemEffectDef(
                        system_id="radar-primary",
                        operational_state="red",
                        power_state=False,
                    ),
                    SystemEffectDef(
                        system_id="radar-backup",
                        operational_state="yellow",
                        power_state=None,
                    ),
                ],
                targets_system=True,
                max_plays=2,
            ),
            DecisionOptionDef(
                id="o-no",
                label="Keep running",
                score=0.0,
                system_effects=[],
                targets_system=False,
                max_plays=1,
            ),
        ],
        completion_mode="first_response",
    )
    content = _minimal_content(decision_templates=[dt])
    config = build_engine_config(exercise_id=99, title="System Test", content=content)

    assert len(config.decision_templates) == 1
    tmpl = config.decision_templates[0]
    assert tmpl.id == "dt-sys"
    assert len(tmpl.options) == 2

    opt_yes = tmpl.options[0]
    assert opt_yes["id"] == "o-yes"
    assert opt_yes["targets_system"] is True
    assert opt_yes["max_plays"] == 2
    assert len(opt_yes["system_effects"]) == 2

    eff0 = opt_yes["system_effects"][0]
    assert eff0["system_id"] == "radar-primary"
    assert eff0["operational_state"] == "red"
    assert eff0["power_state"] is False

    eff1 = opt_yes["system_effects"][1]
    assert eff1["system_id"] == "radar-backup"
    assert eff1["operational_state"] == "yellow"
    assert eff1["power_state"] is None

    opt_no = tmpl.options[1]
    assert opt_no["id"] == "o-no"
    assert opt_no["targets_system"] is False
    assert opt_no["max_plays"] == 1
    assert opt_no["system_effects"] == []


# -- max_possible_score computation ----------------------------------------


def test_max_possible_score_single_choice() -> None:
    """Single choice: max of option scores per template."""
    dt = DecisionTemplateDef(
        id="dt1",
        title="T",
        description="D",
        issue_id="",
        question_type="single_choice",
        options=[
            DecisionOptionDef(id="a", label="A", score=3.0),
            DecisionOptionDef(id="b", label="B", score=10.0),
            DecisionOptionDef(id="c", label="C", score=5.0),
        ],
        completion_mode="first_response",
    )
    content = _minimal_content(decision_templates=[dt], decision_sequence=["dt1"])
    assert _compute_max_possible_score(content) == 10.0


def test_max_possible_score_multi_choice_with_max_selections() -> None:
    """Multi choice with max_selections=2: sum of top 2 scores."""
    dt = DecisionTemplateDef(
        id="dt1",
        title="T",
        description="D",
        issue_id="",
        question_type="multi_choice",
        options=[
            DecisionOptionDef(id="a", label="A", score=10.0),
            DecisionOptionDef(id="b", label="B", score=8.0),
            DecisionOptionDef(id="c", label="C", score=3.0),
        ],
        completion_mode="first_response",
        max_selections=2,
    )
    content = _minimal_content(decision_templates=[dt], decision_sequence=["dt1"])
    assert _compute_max_possible_score(content) == 18.0


def test_max_possible_score_multi_choice_unlimited() -> None:
    """Multi choice with no max_selections: sum of positive scores only."""
    dt = DecisionTemplateDef(
        id="dt1",
        title="T",
        description="D",
        issue_id="",
        question_type="multi_choice",
        options=[
            DecisionOptionDef(id="a", label="A", score=10.0),
            DecisionOptionDef(id="b", label="B", score=8.0),
            DecisionOptionDef(id="c", label="C", score=-2.0),
        ],
        completion_mode="first_response",
    )
    content = _minimal_content(decision_templates=[dt], decision_sequence=["dt1"])
    # Only positive scores: 10 + 8 = 18 (rational player skips -2)
    assert _compute_max_possible_score(content) == 18.0


def test_max_possible_score_multiple_decisions() -> None:
    """Sum across multiple decisions in sequence."""
    dt1 = DecisionTemplateDef(
        id="dt1", title="T1", description="", issue_id="",
        question_type="single_choice",
        options=[
            DecisionOptionDef(id="a", label="A", score=10.0),
            DecisionOptionDef(id="b", label="B", score=5.0),
        ],
        completion_mode="first_response",
    )
    dt2 = DecisionTemplateDef(
        id="dt2", title="T2", description="", issue_id="",
        question_type="multi_choice",
        options=[
            DecisionOptionDef(id="c", label="C", score=20.0),
            DecisionOptionDef(id="d", label="D", score=15.0),
        ],
        completion_mode="first_response",
        max_selections=2,
    )
    content = _minimal_content(
        decision_templates=[dt1, dt2],
        decision_sequence=["dt1", "dt2"],
    )
    # dt1: 10 (single) + dt2: 20+15 (multi, top-2) = 45
    assert _compute_max_possible_score(content) == 45.0


def test_max_possible_score_ignores_non_sequenced_templates() -> None:
    """Templates not in decision_sequence are excluded."""
    dt1 = DecisionTemplateDef(
        id="dt1", title="T1", description="", issue_id="",
        question_type="single_choice",
        options=[DecisionOptionDef(id="a", label="A", score=10.0)],
        completion_mode="first_response",
    )
    dt_extra = DecisionTemplateDef(
        id="dt-extra", title="Extra", description="", issue_id="",
        question_type="single_choice",
        options=[DecisionOptionDef(id="x", label="X", score=99.0)],
        completion_mode="first_response",
    )
    content = _minimal_content(
        decision_templates=[dt1, dt_extra],
        decision_sequence=["dt1"],
    )
    assert _compute_max_possible_score(content) == 10.0


def test_build_engine_config_passes_score_tier_thresholds() -> None:
    """score_tier_thresholds from scenario content reach ScenarioContext."""
    content = _minimal_content(
        score_tier_thresholds={"lo": 0.33, "mid": 0.66},
    )
    config = build_engine_config(exercise_id=1, title="Test", content=content)
    assert config.context.score_tier_thresholds == {"lo": 0.33, "mid": 0.66}
