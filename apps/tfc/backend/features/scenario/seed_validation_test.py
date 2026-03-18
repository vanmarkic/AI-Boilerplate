"""Tests that all seed JSON files pass ScenarioContent validation."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from features.scenario.scenario_content import ScenarioContent

SEEDS_DIR = Path(__file__).parent.parent.parent / "seeds"


def _seed_files() -> list[Path]:
    return sorted(SEEDS_DIR.glob("*.json"))


@pytest.mark.parametrize("seed_path", _seed_files(), ids=lambda p: p.stem)
def test_seed_content_validates(seed_path: Path) -> None:
    """Each seed file's content must pass ScenarioContent validation."""
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
