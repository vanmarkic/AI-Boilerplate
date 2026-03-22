"""Tests for SimpleCollaborativeMode — scoring, stress, auto-submit."""

from __future__ import annotations

from engine.game_modes.simple_collaborative import STRESS_TIME_TABLE, SimpleCollaborativeMode


def _mode(**kwargs: object) -> SimpleCollaborativeMode:
    defaults = {
        "decision_sequence": ["d1", "d2", "d3"],
        "base_decision_time_ms": 300_000,
    }
    defaults.update(kwargs)
    return SimpleCollaborativeMode(**defaults)


def _close_v2(
    mode: SimpleCollaborativeMode,
    decision_id: str,
    selected_score: float,
    max_score: float,
    stress_delta: int = 0,
) -> list[dict]:
    """Helper: wrap scalar scores as v2 option lists for testing."""
    selected = [
        {
            "id": "sel",
            "label": "Sel",
            "score": selected_score,
            "stress_delta": stress_delta,
            "system_effects": [],
            "targets_system": False,
            "max_plays": 1,
            "role": None,
        }
    ]
    all_opts = [
        {
            "id": "sel",
            "label": "Sel",
            "score": selected_score,
            "stress_delta": stress_delta,
            "system_effects": [],
            "targets_system": False,
            "max_plays": 1,
            "role": None,
        },
        {
            "id": "best",
            "label": "Best",
            "score": max_score,
            "stress_delta": 0,
            "system_effects": [],
            "targets_system": False,
            "max_plays": 1,
            "role": None,
        },
    ]
    return mode.on_decision_closed_v2(decision_id, selected, all_opts)


def test_should_not_pause() -> None:
    assert _mode().should_pause_on_decision() is False


def test_does_not_require_gm() -> None:
    assert _mode().requires_gm() is False


def test_auto_submit_picks_worst_option() -> None:
    mode = _mode()
    options = [
        {
            "id": "good",
            "label": "Good",
            "score": 3.0,
            "stress_delta": 0,
            "system_effects": [],
            "targets_system": False,
            "max_plays": 1,
            "role": None,
        },
        {
            "id": "bad",
            "label": "Bad",
            "score": 0.5,
            "stress_delta": 0,
            "system_effects": [],
            "targets_system": False,
            "max_plays": 1,
            "role": None,
        },
        {
            "id": "ok",
            "label": "OK",
            "score": 1.5,
            "stress_delta": 0,
            "system_effects": [],
            "targets_system": False,
            "max_plays": 1,
            "role": None,
        },
    ]
    assert mode.on_decision_timeout("d1", options) == "bad"


def test_auto_submit_empty_options() -> None:
    mode = _mode()
    assert mode.on_decision_timeout("d1", []) is None


def test_perfect_score_no_stress() -> None:
    mode = _mode()
    opts = [
        {
            "id": "a",
            "label": "A",
            "score": 3.0,
            "stress_delta": 0,
            "system_effects": [],
            "targets_system": False,
            "max_plays": 1,
            "role": None,
        }
    ]
    changes = mode.on_decision_closed_v2("d1", opts, opts)
    sc = next(c for c in changes if c["type"] == "score_change")
    assert sc["total_score"] == 3.0
    assert sc["stress"] == 0
    assert sc["turn_number"] == 2
    assert mode.stress == 0


def test_stress_increases_with_positive_delta() -> None:
    mode = _mode()
    _close_v2(mode, "d1", selected_score=1.0, max_score=3.0, stress_delta=2)
    assert mode.stress == 2
    assert mode.get_decision_time_ms(300_000) == STRESS_TIME_TABLE[2]


def test_stress_accumulates() -> None:
    mode = _mode()
    _close_v2(mode, "d1", selected_score=1.0, max_score=3.0, stress_delta=3)
    _close_v2(mode, "d2", selected_score=0.0, max_score=2.0, stress_delta=2)
    assert mode.stress == 5
    assert mode.total_score == 1.0
    assert mode.turn_number == 3


def test_stress_clamped_at_10() -> None:
    mode = _mode()
    mode.stress = 8
    _close_v2(mode, "d1", selected_score=1.0, max_score=3.0, stress_delta=5)
    assert mode.stress == 10


def test_stress_clamped_at_0() -> None:
    mode = _mode()
    mode.stress = 2
    _close_v2(mode, "d1", selected_score=1.0, max_score=1.0, stress_delta=-5)
    assert mode.stress == 0


def test_stress_time_table_lookup() -> None:
    mode = _mode()
    for stress_level, expected_ms in STRESS_TIME_TABLE.items():
        mode.stress = stress_level
        assert mode.get_decision_time_ms(300_000) == expected_ms


def test_stress_out_of_table_gives_180000() -> None:
    """Stress values outside the table fall back to 180_000."""
    mode = _mode()
    mode.stress = 10
    # Stress 10 is in the table
    assert mode.get_decision_time_ms(300_000) == 180_000
    # If somehow stress were beyond 10 (shouldn't happen but defensive)
    mode.stress = 99
    assert mode.get_decision_time_ms(300_000) == 180_000


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
    _close_v2(mode, "d1", selected_score=0.0, max_score=2.0, stress_delta=3)
    changes = _close_v2(mode, "d2", selected_score=1.0, max_score=2.0, stress_delta=2)
    sc = next(c for c in changes if c["type"] == "score_change")
    # stress should be 3 + 2 = 5
    assert sc["next_decision_time_ms"] == STRESS_TIME_TABLE[5]


# -- Phase 2: Option-list based scoring -----------------------------------


_OPTS = [
    {
        "id": "good",
        "label": "Good",
        "score": 10.0,
        "stress_delta": 0,
        "system_effects": [],
        "targets_system": False,
        "max_plays": 1,
        "role": None,
    },
    {
        "id": "ok",
        "label": "OK",
        "score": 6.0,
        "stress_delta": 1,
        "system_effects": [],
        "targets_system": False,
        "max_plays": 1,
        "role": None,
    },
    {
        "id": "bad",
        "label": "Bad",
        "score": -2.0,
        "stress_delta": 2,
        "system_effects": [],
        "targets_system": False,
        "max_plays": 1,
        "role": None,
    },
]


def test_option_scoring_single_card() -> None:
    """Selecting 1 card: score = card score, max = top-1 score."""
    mode = _mode()
    selected = [_OPTS[1]]  # ok, score=6, stress_delta=1
    changes = mode.on_decision_closed_v2("d1", selected, _OPTS)
    assert changes[0]["total_score"] == 6.0
    assert changes[0]["stress"] == 1


def test_option_scoring_multiple_cards() -> None:
    """Selecting 2 cards: score = sum, max = sum of top-2."""
    mode = _mode()
    selected = [_OPTS[1], _OPTS[2]]  # ok + bad = 6.0 + (-2.0) = 4.0
    changes = mode.on_decision_closed_v2("d1", selected, _OPTS)
    assert changes[0]["total_score"] == 4.0
    # stress_delta = 1 + 2 = 3
    assert changes[0]["stress"] == 3


def test_option_scoring_negative_score_reduces_total() -> None:
    """A negative-score card reduces total_score."""
    mode = _mode()
    selected = [_OPTS[2]]  # bad, score=-2.0
    changes = mode.on_decision_closed_v2("d1", selected, _OPTS)
    assert changes[0]["total_score"] == -2.0


def test_option_scoring_perfect_selection_no_stress() -> None:
    """Selecting the best card(s) with zero stress_delta -> zero stress."""
    mode = _mode()
    selected = [_OPTS[0]]  # good, score=10, stress_delta=0
    changes = mode.on_decision_closed_v2("d1", selected, _OPTS)
    assert changes[0]["stress"] == 0


def test_option_scoring_advances_turn_and_index() -> None:
    mode = _mode()
    mode.on_decision_closed_v2("d1", [_OPTS[0]], _OPTS)
    assert mode.turn_number == 2
    assert mode.current_index == 1


# -- Phase 3: Forced card enforcement -------------------------------------


def test_forced_card_present_no_extra_change() -> None:
    """If player selects the forced card, no forced-card change applied."""
    mode = _mode()
    forced = ["good"]
    selected = [_OPTS[0]]  # includes forced card
    changes = mode.on_decision_closed_v2("d1", selected, _OPTS, forced_option_ids=forced)
    # No ForcedCardApplied change emitted
    assert all(c["type"] != "forced_card_applied" for c in changes)


def test_forced_card_missing_auto_added() -> None:
    """If player omits forced card, it's auto-added."""
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
    """No forced_option_ids -> no forced card logic fires."""
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
    assert snap["stress"] == 0
    assert snap["turn_number"] == 1
    assert snap["next_decision_time_ms"] == 300_000


def test_snapshot_after_decisions() -> None:
    """Snapshot reflects accumulated score after decisions close."""
    mode = _mode()
    mode.on_decision_closed_v2("d1", [_OPTS[0]], _OPTS)  # good=10, stress_delta=0
    snap = mode.snapshot()
    assert snap is not None
    assert snap["total_score"] == 10.0
    assert snap["turn_number"] == 2


# -- Tier calculation -------------------------------------------------------


def test_compute_tier_no_thresholds() -> None:
    """No thresholds configured -> None."""
    mode = _mode()
    assert mode.compute_tier() is None


def test_compute_tier_no_max_score() -> None:
    """max_possible_score=0 -> None (avoid division by zero)."""
    mode = _mode(score_tier_thresholds={"lo": 0.33, "mid": 0.66}, max_possible_score=0.0)
    assert mode.compute_tier() is None


def test_compute_tier_lo() -> None:
    """Score below lo threshold -> 'lo'."""
    mode = _mode(score_tier_thresholds={"lo": 0.33, "mid": 0.66}, max_possible_score=100.0)
    mode.total_score = 20.0  # 0.20 < 0.33
    assert mode.compute_tier() == "lo"


def test_compute_tier_mid() -> None:
    """Score between lo and mid threshold -> 'mid'."""
    mode = _mode(score_tier_thresholds={"lo": 0.33, "mid": 0.66}, max_possible_score=100.0)
    mode.total_score = 50.0  # 0.50 >= 0.33 and < 0.66
    assert mode.compute_tier() == "mid"


def test_compute_tier_hi() -> None:
    """Score at or above mid threshold -> 'hi'."""
    mode = _mode(score_tier_thresholds={"lo": 0.33, "mid": 0.66}, max_possible_score=100.0)
    mode.total_score = 80.0  # 0.80 >= 0.66
    assert mode.compute_tier() == "hi"


def test_compute_tier_exact_boundaries() -> None:
    """Exact boundary values: lo boundary -> 'mid', mid boundary -> 'hi'."""
    mode = _mode(score_tier_thresholds={"lo": 0.33, "mid": 0.66}, max_possible_score=100.0)
    mode.total_score = 33.0  # 0.33 — exactly at lo boundary
    assert mode.compute_tier() == "mid"
    mode.total_score = 66.0  # 0.66 — exactly at mid boundary
    assert mode.compute_tier() == "hi"


def test_compute_tier_negative_score() -> None:
    """Negative score -> 'lo'."""
    mode = _mode(score_tier_thresholds={"lo": 0.33, "mid": 0.66}, max_possible_score=100.0)
    mode.total_score = -10.0
    assert mode.compute_tier() == "lo"


def test_snapshot_includes_score_tier() -> None:
    """Snapshot includes score_tier field."""
    mode = _mode(score_tier_thresholds={"lo": 0.33, "mid": 0.66}, max_possible_score=100.0)
    mode.total_score = 80.0
    snap = mode.snapshot()
    assert snap is not None
    assert snap["score_tier"] == "hi"


def test_snapshot_score_tier_none_without_thresholds() -> None:
    """Snapshot score_tier is None when no thresholds configured."""
    mode = _mode()
    snap = mode.snapshot()
    assert snap is not None
    assert snap["score_tier"] is None
