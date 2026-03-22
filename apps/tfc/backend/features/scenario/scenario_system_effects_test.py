"""Tests for system_effects fields on DecisionOptionDef and DecisionOptionSnapshot.

Task 3A: system_effects, targets_system, max_plays added to decision option types.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from features.scenario.scenario_content import (
    DecisionOptionDef,
    DecisionTemplateDef,
    ScenarioContent,
    SystemEffectDef,
)
from features.scenario.scenario_loader import load_decision_templates

MINIMAL_ROLES = [
    {"id": "co", "label": "CO", "player_type": "decision_maker"},
]


# ── SystemEffectDef tests ─────────────────────────────────────────────────


class TestSystemEffectDef:
    def test_minimal_system_effect_requires_system_id(self) -> None:
        effect = SystemEffectDef(system_id="nav")
        assert effect.system_id == "nav"
        assert effect.operational_state is None
        assert effect.power_state is None

    def test_operational_state_set(self) -> None:
        effect = SystemEffectDef(system_id="nav", operational_state="red")
        assert effect.operational_state == "red"

    def test_power_state_set(self) -> None:
        effect = SystemEffectDef(system_id="nav", power_state=False)
        assert effect.power_state is False

    def test_both_fields_set(self) -> None:
        effect = SystemEffectDef(system_id="comms", operational_state="yellow", power_state=True)
        assert effect.operational_state == "yellow"
        assert effect.power_state is True

    def test_missing_system_id_raises(self) -> None:
        with pytest.raises(ValidationError):
            SystemEffectDef.model_validate({"operational_state": "red"})

    def test_model_validate_from_dict(self) -> None:
        effect = SystemEffectDef.model_validate({"system_id": "radar", "power_state": True})
        assert effect.system_id == "radar"
        assert effect.power_state is True
        assert effect.operational_state is None


# ── DecisionOptionDef new fields ──────────────────────────────────────────


class TestDecisionOptionDefNewFields:
    def test_defaults_for_new_fields(self) -> None:
        opt = DecisionOptionDef(id="o1", label="Option A", score=1.0)
        assert opt.system_effects == []
        assert opt.targets_system is False
        assert opt.max_plays == 0  # 0 = unlimited (default)

    def test_targets_system_true(self) -> None:
        opt = DecisionOptionDef(id="o1", label="Option A", targets_system=True)
        assert opt.targets_system is True

    def test_max_plays_custom(self) -> None:
        opt = DecisionOptionDef(id="o1", label="Option A", max_plays=3)
        assert opt.max_plays == 3

    def test_system_effects_list(self) -> None:
        opt = DecisionOptionDef(
            id="o1",
            label="Option A",
            system_effects=[
                SystemEffectDef(system_id="nav", operational_state="red"),
            ],
            targets_system=True,
        )
        assert len(opt.system_effects) == 1
        assert opt.system_effects[0].system_id == "nav"
        assert opt.system_effects[0].operational_state == "red"

    def test_multiple_system_effects(self) -> None:
        opt = DecisionOptionDef(
            id="o1",
            label="Option A",
            system_effects=[
                SystemEffectDef(system_id="nav", operational_state="red"),
                SystemEffectDef(system_id="comms", power_state=False),
            ],
            targets_system=True,
        )
        assert len(opt.system_effects) == 2

    def test_model_validate_from_dict_with_system_effects(self) -> None:
        data = {
            "id": "o1",
            "label": "Option A",
            "score": 2.0,
            "system_effects": [
                {"system_id": "radar", "operational_state": "yellow"},
            ],
            "targets_system": True,
            "max_plays": 2,
        }
        opt = DecisionOptionDef.model_validate(data)
        assert opt.targets_system is True
        assert opt.max_plays == 2
        assert len(opt.system_effects) == 1
        assert opt.system_effects[0].system_id == "radar"


# ── scenario_loader propagates new fields to DecisionOptionSnapshot ───────


def _content_with_option(**option_kwargs: object) -> ScenarioContent:
    dt = DecisionTemplateDef(
        id="dt1",
        title="T",
        issue_id="i1",
        question_type="single_choice",
        options=[DecisionOptionDef(id="o1", label="Go", score=1.0, **option_kwargs)],
    )
    return ScenarioContent(
        roles=MINIMAL_ROLES,
        decision_templates=[dt],
    )


class TestLoaderPropagatesNewFields:
    def test_defaults_propagated_to_snapshot(self) -> None:
        content = _content_with_option()
        templates = load_decision_templates(content)
        snap = templates[0].options[0]
        assert snap["system_effects"] == []
        assert snap["targets_system"] is False
        assert snap["max_plays"] == 0  # 0 = unlimited (default)

    def test_system_effects_propagated(self) -> None:
        content = _content_with_option(
            system_effects=[SystemEffectDef(system_id="nav", operational_state="red")],
            targets_system=True,
        )
        templates = load_decision_templates(content)
        snap = templates[0].options[0]
        assert snap["targets_system"] is True
        assert len(snap["system_effects"]) == 1
        effect = snap["system_effects"][0]
        assert effect["system_id"] == "nav"
        assert effect["operational_state"] == "red"
        assert effect["power_state"] is None

    def test_max_plays_propagated(self) -> None:
        content = _content_with_option(max_plays=3)
        templates = load_decision_templates(content)
        snap = templates[0].options[0]
        assert snap["max_plays"] == 3

    def test_existing_fields_unchanged(self) -> None:
        """Legacy fields (id, label, score, stress_delta, role) still present."""
        content = _content_with_option()
        templates = load_decision_templates(content)
        snap = templates[0].options[0]
        assert snap["id"] == "o1"
        assert snap["label"] == "Go"
        assert snap["score"] == 1.0
        assert snap["stress_delta"] == 0
        assert snap["role"] is None

    def test_snapshot_from_dict_validates_structure(self) -> None:
        """Snapshot dict must contain all required keys."""
        content = _content_with_option(
            system_effects=[SystemEffectDef(system_id="comms", power_state=False)],
            targets_system=True,
            max_plays=2,
        )
        templates = load_decision_templates(content)
        snap = templates[0].options[0]
        required_keys = {
            "id",
            "label",
            "score",
            "stress_delta",
            "role",
            "system_effects",
            "targets_system",
            "max_plays",
        }
        assert required_keys.issubset(snap.keys())
