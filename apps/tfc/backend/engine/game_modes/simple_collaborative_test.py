"""Tests for SimpleCollaborativeMode — scoring, penalties, auto-submit."""
from __future__ import annotations

from engine.game_modes.simple_collaborative import SimpleCollaborativeMode


def _mode(**kwargs) -> SimpleCollaborativeMode:
    defaults = {
        "decision_sequence": ["d1", "d2", "d3"],
        "base_decision_time_ms": 300_000,
        "penalty_factor": 0.1,
        "min_decision_time_ms": 30_000,
    }
    defaults.update(kwargs)
    return SimpleCollaborativeMode(**defaults)


def test_should_not_pause() -> None:
    assert _mode().should_pause_on_decision() is False


def test_does_not_require_gm() -> None:
    assert _mode().requires_gm() is False


def test_auto_submit_picks_worst_option() -> None:
    mode = _mode()
    options = [
        {"id": "good", "label": "Good", "score": 3.0},
        {"id": "bad", "label": "Bad", "score": 0.5},
        {"id": "ok", "label": "OK", "score": 1.5},
    ]
    assert mode.on_decision_timeout("d1", options) == "bad"


def test_auto_submit_empty_options() -> None:
    mode = _mode()
    assert mode.on_decision_timeout("d1", []) is None


def test_perfect_score_no_penalty() -> None:
    mode = _mode()
    changes = mode.on_decision_closed("d1", selected_score=3.0, max_score=3.0)
    assert len(changes) == 1
    assert changes[0]["type"] == "score_change"
    assert changes[0]["total_score"] == 3.0
    assert changes[0]["penalty_ms"] == 0.0
    assert changes[0]["turn_number"] == 1
    assert mode.accumulated_penalty_ms == 0.0


def test_wrong_answer_applies_penalty() -> None:
    mode = _mode()
    mode.on_decision_closed("d1", selected_score=1.0, max_score=3.0)
    # penalty = (3.0 - 1.0) * 0.1 * 1000 = 200ms
    assert mode.accumulated_penalty_ms == 200.0
    assert mode.get_decision_time_ms(300_000) == 300_000 - 200


def test_penalty_accumulates() -> None:
    mode = _mode()
    mode.on_decision_closed("d1", selected_score=1.0, max_score=3.0)
    mode.on_decision_closed("d2", selected_score=0.0, max_score=2.0)
    # penalty1 = 200, penalty2 = (2.0 - 0.0) * 0.1 * 1000 = 200
    assert mode.accumulated_penalty_ms == 400.0
    assert mode.total_score == 1.0
    assert mode.turn_number == 2


def test_penalty_floor() -> None:
    mode = _mode(min_decision_time_ms=30_000)
    mode.accumulated_penalty_ms = 999_999  # extreme penalty
    assert mode.get_decision_time_ms(300_000) == 30_000


def test_decision_sequence_advances() -> None:
    mode = _mode()
    assert mode.get_next_decision_id("d0") == "d1"  # current_index starts at 0
    mode.on_decision_closed("d1", 1.0, 1.0)  # advances current_index to 1
    assert mode.get_next_decision_id("d1") == "d2"
    mode.on_decision_closed("d2", 1.0, 1.0)  # advances to 2
    assert mode.get_next_decision_id("d2") == "d3"
    mode.on_decision_closed("d3", 1.0, 1.0)  # advances to 3 (past end)
    assert mode.get_next_decision_id("d3") is None


def test_score_change_includes_next_decision_time() -> None:
    mode = _mode()
    mode.on_decision_closed("d1", selected_score=0.0, max_score=2.0)
    # penalty = 200ms
    changes = mode.on_decision_closed("d2", selected_score=1.0, max_score=2.0)
    # second penalty = (2.0 - 1.0) * 0.1 * 1000 = 100
    assert changes[0]["next_decision_time_ms"] == 300_000 - 300
