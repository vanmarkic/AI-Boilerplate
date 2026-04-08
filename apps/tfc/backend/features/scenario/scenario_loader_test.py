"""Tests for scenario_loader — converting ScenarioContent to EngineConfig."""

from __future__ import annotations

from features.scenario.scenario_content import (
    DecisionOptionDef,
    DecisionTemplateDef,
    DomainEffectDef,
    ScenarioContent,
    SystemEffectDef,
    SystemStateDef,
    TurnCardConfig,
    TurnDefinition,
    TurnInjectDef,
    WarfareDomainDef,
)
from features.scenario.scenario_loader import (
    _compute_max_possible_score,
    build_engine_config,
    generate_decisions_from_turns,
    generate_events_from_turns,
    load_decision_templates,
    merge_system_states,
    merge_warfare_domains,
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
        "description": "",
        "score": 1.0,
        "stress_delta": 0,
        "system_effects": [],
        "targets_system": False,
        "max_plays": 0,
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
        id="dt1",
        title="T1",
        description="",
        issue_id="",
        question_type="single_choice",
        options=[
            DecisionOptionDef(id="a", label="A", score=10.0),
            DecisionOptionDef(id="b", label="B", score=5.0),
        ],
        completion_mode="first_response",
    )
    dt2 = DecisionTemplateDef(
        id="dt2",
        title="T2",
        description="",
        issue_id="",
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
        id="dt1",
        title="T1",
        description="",
        issue_id="",
        question_type="single_choice",
        options=[DecisionOptionDef(id="a", label="A", score=10.0)],
        completion_mode="first_response",
    )
    dt_extra = DecisionTemplateDef(
        id="dt-extra",
        title="Extra",
        description="",
        issue_id="",
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


# -- Task 4: generate_events_from_turns / generate_decisions_from_turns ------


def test_generate_events_from_turn_with_injects() -> None:
    """Each inject becomes a ScenarioEventDef; first inject of decision turn is 'decision'."""
    turns = [
        TurnDefinition(
            turn_index=0,
            title="Turn 0",
            has_decisions=True,
            injects=[
                TurnInjectDef(text="Enemy spotted", target_roles=["co"]),
                TurnInjectDef(text="Radar contact", target_roles=["tao"]),
            ],
        ),
    ]
    events = generate_events_from_turns(turns)

    assert len(events) == 2
    assert events[0].id == "turn-0-inject-0"
    assert events[0].event_type == "decision"
    assert events[0].description == "Enemy spotted"
    assert events[0].target_roles == ["co"]

    assert events[1].id == "turn-0-inject-1"
    assert events[1].event_type == "informational"
    assert events[1].description == "Radar contact"


def test_generate_events_with_system_effects_on_start() -> None:
    """Turn-level system/domain effects attach to first event only."""
    turns = [
        TurnDefinition(
            turn_index=1,
            title="Turn 1",
            has_decisions=False,
            injects=[
                TurnInjectDef(text="First inject"),
                TurnInjectDef(text="Second inject"),
            ],
            system_effects_on_start=[
                SystemEffectDef(system_id="radar", operational_state="red"),
            ],
            domain_effects_on_start=[
                DomainEffectDef(domain_id="air", threat_level="yellow"),
            ],
        ),
    ]
    events = generate_events_from_turns(turns)

    assert len(events) == 2
    # First event gets the effects
    assert len(events[0].system_effects) == 1
    assert events[0].system_effects[0].system_id == "radar"
    assert len(events[0].domain_effects) == 1
    assert events[0].domain_effects[0].domain_id == "air"
    # Second event does not
    assert events[1].system_effects == []
    assert events[1].domain_effects == []


def test_generate_events_no_injects_but_effects_creates_marker() -> None:
    """Turn with no injects but effects creates a marker event."""
    turns = [
        TurnDefinition(
            turn_index=2,
            title="Effects Only",
            has_decisions=False,
            injects=[],
            system_effects_on_start=[
                SystemEffectDef(system_id="sonar", power_state=True),
            ],
        ),
    ]
    events = generate_events_from_turns(turns)

    assert len(events) == 1
    assert events[0].id == "turn-2-marker"
    assert events[0].event_type == "informational"
    assert len(events[0].system_effects) == 1
    assert events[0].system_effects[0].system_id == "sonar"


# -- Task 5: build_engine_config turn integration ----------------------------


def test_build_engine_config_uses_turns_when_present() -> None:
    """When turns have authored injects/cards, build_engine_config uses them."""
    content = _minimal_content(
        turns=[
            TurnDefinition(
                turn_index=0,
                title="Turn 0",
                has_decisions=True,
                injects=[TurnInjectDef(text="Incoming threat")],
                available_cards=[
                    TurnCardConfig(card_id="card-a", score=5.0),
                    TurnCardConfig(card_id="card-b", score=3.0),
                ],
                max_selections=1,
                base_stress_delta=2,
            ),
        ],
    )
    config = build_engine_config(exercise_id=1, title="Turn Test", content=content)

    # Events generated from turns
    assert len(config.events) == 1
    assert config.events[0].id == "turn-0-inject-0"

    # Decision templates generated from turns
    assert len(config.decision_templates) == 1
    dt = config.decision_templates[0]
    assert dt.id == "turn-0-inject-0"
    assert dt.max_selections == 1
    assert dt.stress_delta == 2
    assert len(dt.options) == 2
    assert dt.options[0]["id"] == "card-a"

    # Synthetic issue created
    assert len(config.issues) == 1
    assert config.issues[0].id == "turn-0-issue"

    # Verify synthetic issue linkage on decision template
    assert config.decision_templates[0].issue_id == "turn-0-issue"


def test_build_engine_config_falls_back_to_legacy_events() -> None:
    """When turns are empty, legacy events/decisions are used."""
    from features.scenario.scenario_content import ScenarioEventDef, ScenarioIssueDef

    content = _minimal_content(
        events=[
            ScenarioEventDef(
                id="evt-legacy",
                title="Legacy Event",
                event_type="informational",
                scheduled_pt_ms=1000,
            ),
        ],
        issues=[
            ScenarioIssueDef(
                id="iss-legacy",
                title="Legacy Issue",
                trigger_mode="manual",
            ),
        ],
        turns=[],
    )
    config = build_engine_config(exercise_id=2, title="Legacy Test", content=content)

    assert len(config.events) == 1
    assert config.events[0].id == "evt-legacy"
    assert len(config.issues) == 1
    assert config.issues[0].id == "iss-legacy"


# -- Task 6: merge functions -------------------------------------------------


def test_merge_system_states_with_overrides() -> None:
    """Scenario overrides replace matching systems from domain config."""
    domain_systems = [
        {"system_id": "radar", "label": "Radar", "category": "system"},
        {"system_id": "sonar", "label": "Sonar", "category": "system"},
    ]
    overrides = [
        SystemStateDef(
            system_id="radar",
            label="Radar Override",
            operational_state="red",
            power_state=True,
        ),
    ]
    result = merge_system_states(domain_systems, overrides)

    assert len(result) == 2
    radar = next(s for s in result if s.system_id == "radar")
    assert radar.label == "Radar Override"
    assert radar.operational_state == "red"
    assert radar.power_state is True

    sonar = next(s for s in result if s.system_id == "sonar")
    assert sonar.label == "Sonar"
    assert sonar.operational_state == "green"  # default
    assert sonar.power_state is False  # default


def test_merge_system_states_no_overrides() -> None:
    """Without overrides, domain defaults are used as-is."""
    domain_systems = [
        {"system_id": "radar", "label": "Radar", "category": "weapon"},
    ]
    result = merge_system_states(domain_systems, [])

    assert len(result) == 1
    assert result[0].system_id == "radar"
    assert result[0].label == "Radar"
    assert result[0].category == "weapon"
    assert result[0].operational_state == "green"


def test_merge_warfare_domains_with_overrides() -> None:
    """Scenario overrides replace matching warfare domains."""
    domain_wds = [
        {"domain_id": "air", "label": "Air", "initial_threat_level": "green"},
        {"domain_id": "surface", "label": "Surface", "initial_threat_level": "green"},
    ]
    overrides = [
        WarfareDomainDef(
            domain_id="air",
            label="Air Domain",
            initial_threat_level="red",
        ),
    ]
    result = merge_warfare_domains(domain_wds, overrides)

    assert len(result) == 2
    air = next(wd for wd in result if wd.domain_id == "air")
    assert air.label == "Air Domain"
    assert air.initial_threat_level == "red"

    surface = next(wd for wd in result if wd.domain_id == "surface")
    assert surface.label == "Surface"
    assert surface.initial_threat_level == "green"


def test_merge_warfare_domains_no_overrides() -> None:
    """Without overrides, domain defaults are used as-is."""
    domain_wds = [
        {"domain_id": "air", "label": "Air", "initial_threat_level": "yellow"},
    ]
    result = merge_warfare_domains(domain_wds, [])

    assert len(result) == 1
    assert result[0].domain_id == "air"
    assert result[0].label == "Air"
    assert result[0].initial_threat_level == "yellow"


# -- Task 7: card label resolution from catalog ------------------------------


def test_resolve_card_labels_from_catalog() -> None:
    """When blue_card_catalog is provided, labels and targets_system resolve from it."""
    turns = [
        TurnDefinition(
            turn_index=0,
            title="Turn 0",
            has_decisions=True,
            available_cards=[
                TurnCardConfig(card_id="bc-01", score=5.0),
                TurnCardConfig(card_id="bc-02", score=3.0),
            ],
        ),
    ]
    catalog = [
        {"id": "bc-01", "title": "Deploy Chaff", "targets_system": True},
        {"id": "bc-02", "title": "Activate CIWS", "targets_system": False},
    ]
    decisions = generate_decisions_from_turns(turns, blue_card_catalog=catalog)

    assert len(decisions) == 1
    opts = decisions[0].options
    assert opts[0].id == "bc-01"
    assert opts[0].label == "Deploy Chaff"
    assert opts[0].targets_system is True

    assert opts[1].id == "bc-02"
    assert opts[1].label == "Activate CIWS"
    assert opts[1].targets_system is False


def test_resolve_card_labels_no_catalog_uses_card_id() -> None:
    """Without catalog, card_id is used as label and targets_system defaults False."""
    turns = [
        TurnDefinition(
            turn_index=0,
            title="Turn 0",
            has_decisions=True,
            available_cards=[
                TurnCardConfig(card_id="bc-99", score=1.0),
            ],
        ),
    ]
    decisions = generate_decisions_from_turns(turns, blue_card_catalog=None)

    assert len(decisions) == 1
    opt = decisions[0].options[0]
    assert opt.id == "bc-99"
    assert opt.label == "bc-99"
    assert opt.targets_system is False
