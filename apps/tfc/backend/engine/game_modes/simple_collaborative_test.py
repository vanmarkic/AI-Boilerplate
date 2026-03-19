"""Tests for SimpleCollaborativeMode — scoring, penalties, auto-submit."""

from __future__ import annotations

from engine.game_modes.simple_collaborative import SimpleCollaborativeMode


def _mode(**kwargs: object) -> SimpleCollaborativeMode:
    defaults = {
        "decision_sequence": ["d1", "d2", "d3"],
        "base_decision_time_ms": 300_000,
        "penalty_factor": 0.1,
        "min_decision_time_ms": 30_000,
    }
    defaults.update(kwargs)
    return SimpleCollaborativeMode(**defaults)


def _close_v2(
    mode: SimpleCollaborativeMode,
    decision_id: str,
    selected_score: float,
    max_score: float,
) -> list[dict]:
    """Helper: wrap scalar scores as v2 option lists for testing."""
    selected = [{"id": "sel", "label": "Sel", "score": selected_score}]
    all_opts = [
        {"id": "sel", "label": "Sel", "score": selected_score},
        {"id": "best", "label": "Best", "score": max_score},
    ]
    return mode.on_decision_closed_v2(decision_id, selected, all_opts)


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
    opts = [{"id": "a", "label": "A", "score": 3.0}]
    changes = mode.on_decision_closed_v2("d1", opts, opts)
    sc = next(c for c in changes if c["type"] == "score_change")
    assert sc["total_score"] == 3.0
    assert sc["penalty_ms"] == 0.0
    assert sc["turn_number"] == 2
    assert mode.accumulated_penalty_ms == 0.0


def test_wrong_answer_applies_penalty() -> None:
    mode = _mode()
    _close_v2(mode, "d1", selected_score=1.0, max_score=3.0)
    # penalty = (3.0 - 1.0) * 0.1 * 1000 = 200ms
    assert mode.accumulated_penalty_ms == 200.0
    assert mode.get_decision_time_ms(300_000) == 300_000 - 200


def test_penalty_accumulates() -> None:
    mode = _mode()
    _close_v2(mode, "d1", selected_score=1.0, max_score=3.0)
    _close_v2(mode, "d2", selected_score=0.0, max_score=2.0)
    # penalty1 = 200, penalty2 = (2.0 - 0.0) * 0.1 * 1000 = 200
    assert mode.accumulated_penalty_ms == 400.0
    assert mode.total_score == 1.0
    assert mode.turn_number == 3


def test_penalty_floor() -> None:
    mode = _mode(min_decision_time_ms=30_000)
    mode.accumulated_penalty_ms = 999_999  # extreme penalty
    assert mode.get_decision_time_ms(300_000) == 30_000


def test_decision_sequence_advances() -> None:
    mode = _mode()
    assert mode.get_next_decision_id("d0") == "d1"  # current_index starts at 0
    _close_v2(mode, "d1", 1.0, 1.0)  # advances current_index to 1
    assert mode.get_next_decision_id("d1") == "d2"
    _close_v2(mode, "d2", 1.0, 1.0)  # advances to 2
    assert mode.get_next_decision_id("d2") == "d3"
    _close_v2(mode, "d3", 1.0, 1.0)  # advances to 3 (past end)
    assert mode.get_next_decision_id("d3") is None


def test_score_change_includes_next_decision_time() -> None:
    mode = _mode()
    _close_v2(mode, "d1", selected_score=0.0, max_score=2.0)
    # penalty = 200ms
    changes = _close_v2(mode, "d2", selected_score=1.0, max_score=2.0)
    # second penalty = (2.0 - 1.0) * 0.1 * 1000 = 100
    sc = next(c for c in changes if c["type"] == "score_change")
    assert sc["next_decision_time_ms"] == 300_000 - 300


# -- Phase 2: Option-list based scoring -----------------------------------


_OPTS = [
    {"id": "good", "label": "Good", "score": 10.0},
    {"id": "ok", "label": "OK", "score": 6.0},
    {"id": "bad", "label": "Bad", "score": -2.0},
]


def test_option_scoring_single_card() -> None:
    """Selecting 1 card: score = card score, max = top-1 score."""
    mode = _mode()
    selected = [_OPTS[1]]  # ok, score=6
    changes = mode.on_decision_closed_v2("d1", selected, _OPTS)
    assert changes[0]["total_score"] == 6.0
    # penalty = (10.0 - 6.0) * 0.1 * 1000 = 400ms
    assert changes[0]["penalty_ms"] == 400.0


def test_option_scoring_multiple_cards() -> None:
    """Selecting 2 cards: score = sum, max = sum of top-2."""
    mode = _mode()
    selected = [_OPTS[1], _OPTS[2]]  # ok + bad = 6.0 + (-2.0) = 4.0
    changes = mode.on_decision_closed_v2("d1", selected, _OPTS)
    assert changes[0]["total_score"] == 4.0
    # max for 2 cards = top-2 scores sorted desc = 10.0 + 6.0 = 16.0
    # penalty = (16.0 - 4.0) * 0.1 * 1000 = 1200ms
    assert abs(changes[0]["penalty_ms"] - 1200.0) < 1e-6


def test_option_scoring_negative_score_reduces_total() -> None:
    """A negative-score card reduces total_score."""
    mode = _mode()
    selected = [_OPTS[2]]  # bad, score=-2.0
    changes = mode.on_decision_closed_v2("d1", selected, _OPTS)
    assert changes[0]["total_score"] == -2.0


def test_option_scoring_perfect_selection_no_penalty() -> None:
    """Selecting the best card(s) → zero penalty."""
    mode = _mode()
    selected = [_OPTS[0]]  # good, score=10
    changes = mode.on_decision_closed_v2("d1", selected, _OPTS)
    assert changes[0]["penalty_ms"] == 0.0


def test_option_scoring_advances_turn_and_index() -> None:
    mode = _mode()
    mode.on_decision_closed_v2("d1", [_OPTS[0]], _OPTS)
    assert mode.turn_number == 2
    assert mode.current_index == 1


# -- Phase 3: Forced card enforcement -------------------------------------


def test_forced_card_present_no_penalty() -> None:
    """If player selects the forced card, no forced-card penalty applied."""
    mode = _mode()
    forced = ["good"]
    selected = [_OPTS[0]]  # includes forced card
    changes = mode.on_decision_closed_v2("d1", selected, _OPTS, forced_option_ids=forced)
    # No ForcedCardApplied change emitted
    assert all(c["type"] != "forced_card_applied" for c in changes)


def test_forced_card_missing_auto_added_with_penalty() -> None:
    """If player omits forced card, it's auto-added and penalty applied."""
    mode = _mode()
    forced = ["good"]
    selected = [_OPTS[1]]  # omits forced card "good"
    changes = mode.on_decision_closed_v2("d1", selected, _OPTS, forced_option_ids=forced)
    forced_changes = [c for c in changes if c["type"] == "forced_card_applied"]
    assert len(forced_changes) == 1
    assert forced_changes[0]["forced_option_id"] == "good"
    assert forced_changes[0]["decision_id"] == "d1"


def test_forced_card_score_included_in_total() -> None:
    """When forced card is auto-added, its score is included in total."""
    mode = _mode()
    forced = ["good"]
    selected = [_OPTS[1]]  # ok=6.0, forced "good"=10.0 auto-added
    changes = mode.on_decision_closed_v2("d1", selected, _OPTS, forced_option_ids=forced)
    score_change = next(c for c in changes if c["type"] == "score_change")
    # total = 6.0 (selected) + 10.0 (forced auto-added) = 16.0
    assert score_change["total_score"] == 16.0


def test_no_forced_cards_no_enforcement() -> None:
    """No forced_option_ids → no forced card logic fires."""
    mode = _mode()
    changes = mode.on_decision_closed_v2("d1", [_OPTS[1]], _OPTS)
    assert all(c["type"] != "forced_card_applied" for c in changes)


# -- Snapshot ----------------------------------------------------------


def test_snapshot_initial_state() -> None:
    """Snapshot returns zeroed score state before any decisions."""
    mode = _mode()
    snap = mode.snapshot()
    assert snap is not None
    assert snap["total_score"] == 0.0
    assert snap["penalty_ms"] == 0.0
    assert snap["turn_number"] == 1
    assert snap["next_decision_time_ms"] == 300_000


def test_snapshot_after_decisions() -> None:
    """Snapshot reflects accumulated score after decisions close."""
    mode = _mode()
    mode.on_decision_closed_v2("d1", [_OPTS[0]], _OPTS)  # good=10, best=10 → 0 penalty
    snap = mode.snapshot()
    assert snap is not None
    assert snap["total_score"] == 10.0
    assert snap["turn_number"] == 2
