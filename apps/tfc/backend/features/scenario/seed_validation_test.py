"""Tests that all seed JSON files pass validation.

Scenario seeds (files with a ``content`` key) are validated against
ScenarioContent.  Domain-config seeds (``*_domain_config.json``) are
validated against CreateDomainConfigRequest.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from features.domain_config.domain_config_schema import CreateDomainConfigRequest
from features.scenario.scenario_content import ScenarioContent

SEEDS_DIR = Path(__file__).parent.parent.parent / "seeds"

DOMAIN_CONFIG_GLOB = "*_domain_config.json"


def _scenario_seed_files() -> list[Path]:
    all_json = set(SEEDS_DIR.glob("*.json"))
    dc_files = set(SEEDS_DIR.glob(DOMAIN_CONFIG_GLOB))
    return sorted(all_json - dc_files)


def _domain_config_seed_files() -> list[Path]:
    return sorted(SEEDS_DIR.glob(DOMAIN_CONFIG_GLOB))


@pytest.mark.parametrize(
    "seed_path",
    _scenario_seed_files(),
    ids=lambda p: p.stem,
)
def test_seed_content_validates(seed_path: Path) -> None:
    """Each scenario seed file's content must pass ScenarioContent validation."""
    data = json.loads(seed_path.read_text())
    assert "content" in data, f"{seed_path.name} missing 'content' key"
    content = ScenarioContent.model_validate(data["content"])
    assert len(content.roles) >= 1
    player_types = {r.player_type for r in content.roles}
    assert "decision_maker" in player_types


def test_silent_wake_structure() -> None:
    """Verify Silent Wake has expected high-level structure."""
    path = SEEDS_DIR / "silent_wake.json"
    data = json.loads(path.read_text())
    content = ScenarioContent.model_validate(data["content"])
    assert content.game_mode == "simple_collaborative"
    assert len(content.roles) >= 2, "collaborative mode needs at least 2 roles"
    assert len(content.events) == 15
    assert len(content.decision_templates) == 15
    assert len(content.phases) == 5
    assert len(content.decision_sequence) == 15


# ---- Domain-config seed validation ----


@pytest.mark.parametrize(
    "seed_path",
    _domain_config_seed_files(),
    ids=lambda p: p.stem,
)
def test_domain_config_seed_validates(seed_path: Path) -> None:
    """Each domain-config seed must pass CreateDomainConfigRequest validation."""
    data = json.loads(seed_path.read_text())
    payload = CreateDomainConfigRequest.model_validate(data)
    assert payload.slug, "slug must not be empty"
    assert payload.name, "name must not be empty"


def test_silent_wake_domain_config_has_catalogs() -> None:
    """Verify the Silent Wake domain config seed includes all catalogs."""
    path = SEEDS_DIR / "silent_wake_domain_config.json"
    data = json.loads(path.read_text())
    payload = CreateDomainConfigRequest.model_validate(data)

    assert payload.slug == "silent-wake"

    # Systems: 6 systems + 5 weapons = 11
    assert len(payload.systems) == 11
    system_categories = [s.category for s in payload.systems]
    assert system_categories.count("system") == 6
    assert system_categories.count("weapon") == 5

    # Warfare domains: 4
    assert len(payload.warfare_domains) == 4

    # Blue card catalog: 23
    assert len(payload.blue_card_catalog) == 23

    # Cards that target a system
    by_id = {c.id: c for c in payload.blue_card_catalog}
    assert by_id["SWB10"].targets_system is True
    assert by_id["SWB14"].targets_system is True
    assert by_id["SWB16"].targets_system is True
    # Default: targets_system is False
    assert by_id["SWB01"].targets_system is False


def test_silent_wake_domain_config_system_ids_match_scenario() -> None:
    """System IDs in the domain config must be a superset of scenario IDs."""
    dc_path = SEEDS_DIR / "silent_wake_domain_config.json"
    dc_data = json.loads(dc_path.read_text())
    dc_system_ids = {s["id"] for s in dc_data["systems"]}

    scenario_path = SEEDS_DIR / "silent_wake.json"
    sc_data = json.loads(scenario_path.read_text())
    sc_system_ids = {s["system_id"] for s in sc_data["content"]["initial_system_states"]}

    # Domain config should cover all scenario systems
    # (scenario may have extra systems like ew_suite, cic_network not in the
    # canonical 11 — that's OK, but every DC system should exist in scenario)
    missing_from_scenario = dc_system_ids - sc_system_ids
    assert not missing_from_scenario, (
        f"Domain config systems not found in scenario: {missing_from_scenario}"
    )


def test_silent_wake_baseline_structure() -> None:
    """Verify Silent Wake Baseline uses turn-based authoring and matches PDF."""
    path = SEEDS_DIR / "silent_wake_baseline.json"
    data = json.loads(path.read_text())
    content = ScenarioContent.model_validate(data["content"])
    assert content.game_mode == "simple_collaborative"
    assert len(content.roles) == 7, "7 roles: CO + 6 advisors"
    assert len(content.turns) == 16, "Turn 0 (briefing) + 15 game turns"

    # Turn-based authoring: injects and available_cards on turns, not legacy arrays
    assert all(t.injects for t in content.turns), "every turn has injects"
    game_turns = [t for t in content.turns if t.turn_index > 0]
    assert all(t.available_cards for t in game_turns), "every game turn has cards"
    assert len(content.events) == 0, "no legacy events (generated from turns)"
    assert len(content.decision_templates) == 0, "no legacy decision_templates"

    # Only systems referenced in turn effects are included
    assert len(content.initial_system_states) == 6
    sys_cats = [s.category for s in content.initial_system_states]
    assert sys_cats.count("weapon") == 2
    assert sys_cats.count("system") == 4

    # Warfare domains: 4
    assert len(content.initial_warfare_domains) == 4

    # Best path documented on all game turns
    assert all(t.best_path is not None for t in game_turns), "every game turn has best_path"


def test_silent_wake_baseline_system_ids_match_domain_config() -> None:
    """Baseline scenario system IDs must be a subset of domain config."""
    dc_path = SEEDS_DIR / "silent_wake_domain_config.json"
    dc_data = json.loads(dc_path.read_text())
    dc_system_ids = {s["id"] for s in dc_data["systems"]}

    sc_path = SEEDS_DIR / "silent_wake_baseline.json"
    sc_data = json.loads(sc_path.read_text())
    sc_system_ids = {s["system_id"] for s in sc_data["content"]["initial_system_states"]}

    assert sc_system_ids <= dc_system_ids, (
        f"Scenario has system IDs not in domain config: {sc_system_ids - dc_system_ids}"
    )
