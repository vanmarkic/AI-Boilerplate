"""Property tests for SimpleCollaborativeMode.

Invariants tested:
- Score monotonicity: total_score never decreases across turns.
- Stress clamping: stress always in [0, 10].
- Timer bounds: effective decision time is always a valid table entry or 180_000.
- Turn counting: turn_number == 1 + number of on_decision_closed_v2 calls.
- Sequence advancement: current_index tracks correctly, None at end.
- Perfect score: zero-stress-delta options -> stress unchanged.
- Auto-submit: timeout always picks the min-score option.
"""

from __future__ import annotations

from hypothesis import assume, given, settings
from hypothesis import strategies as st

from engine.game_modes.simple_collaborative import STRESS_TIME_TABLE, SimpleCollaborativeMode
from engine.strategies import (
    decision_sequences,
    option_lists,
    scores,
    signed_option_lists,
    stress_deltas,
)


def _mode(
    seq: list[str] | None = None,
    base_time: int = 300_000,
) -> SimpleCollaborativeMode:
    return SimpleCollaborativeMode(
        decision_sequence=seq or ["d0", "d1", "d2"],
        base_decision_time_ms=base_time,
    )


def _close_v2(
    mode: SimpleCollaborativeMode,
    decision_id: str,
    selected_score: float,
    max_score: float,
    stress_delta: int = 0,
) -> list[dict]:
    """Helper: wrap scalar scores as v2 option lists for property tests."""
    selected = [{"id": "sel", "label": "Sel", "score": selected_score, "stress_delta": stress_delta, "system_effects": [], "targets_system": False, "max_plays": 1, "role": None}]
    all_opts = [
        {"id": "sel", "label": "Sel", "score": selected_score, "stress_delta": stress_delta, "system_effects": [], "targets_system": False, "max_plays": 1, "role": None},
        {"id": "best", "label": "Best", "score": max_score, "stress_delta": 0, "system_effects": [], "targets_system": False, "max_plays": 1, "role": None},
    ]
    return mode.on_decision_closed_v2(decision_id, selected, all_opts)


# -- Score monotonicity ------------------------------------------------


class TestScoreMonotonicity:
    """total_score never decreases when all option scores are non-negative."""

    @given(
        selected_scores=st.lists(
            scores(),
            min_size=2,
            max_size=20,
        ),
    )
    @settings(max_examples=200)
    def test_total_score_never_decreases(
        self,
        selected_scores: list[float],
    ) -> None:
        mode = _mode(seq=[f"d{i}" for i in range(len(selected_scores))])
        prev_total = 0.0
        for i, sel in enumerate(selected_scores):
            max_s = sel + 1.0  # ensure max >= selected
            _close_v2(mode, f"d{i}", selected_score=sel, max_score=max_s)
            assert mode.total_score >= prev_total
            prev_total = mode.total_score


# -- Stress clamping ---------------------------------------------------


class TestStressClamping:
    """stress always stays in [0, 10]."""

    @given(
        deltas=st.lists(
            stress_deltas(),
            min_size=2,
            max_size=20,
        ),
    )
    @settings(max_examples=200)
    def test_stress_always_clamped(self, deltas: list[int]) -> None:
        mode = _mode(seq=[f"d{i}" for i in range(len(deltas))])
        for i, delta in enumerate(deltas):
            _close_v2(mode, f"d{i}", selected_score=1.0, max_score=1.0, stress_delta=delta)
            assert 0 <= mode.stress <= 10


# -- Timer bounds ------------------------------------------------------


class TestTimerBounds:
    """Effective decision time is always a valid STRESS_TIME_TABLE entry or fallback."""

    @given(
        stress=st.integers(min_value=0, max_value=10),
    )
    @settings(max_examples=50)
    def test_decision_time_from_table(self, stress: int) -> None:
        mode = _mode()
        mode.stress = stress
        effective = mode.get_decision_time_ms(300_000)
        assert effective == STRESS_TIME_TABLE[stress]

    @given(
        stress=st.integers(min_value=11, max_value=100),
    )
    @settings(max_examples=50)
    def test_decision_time_fallback(self, stress: int) -> None:
        mode = _mode()
        mode.stress = stress
        effective = mode.get_decision_time_ms(300_000)
        assert effective == 180_000

    def test_zero_stress_gives_max_time(self) -> None:
        mode = _mode()
        assert mode.get_decision_time_ms(300_000) == 300_000


# -- Turn counting -----------------------------------------------------


class TestTurnCounting:
    """turn_number equals 1 + the number of on_decision_closed_v2 calls."""

    @given(n_turns=st.integers(min_value=0, max_value=30))
    @settings(max_examples=100)
    def test_turn_number_matches_close_count(self, n_turns: int) -> None:
        mode = _mode(seq=[f"d{i}" for i in range(n_turns)])
        for i in range(n_turns):
            _close_v2(mode, f"d{i}", selected_score=1.0, max_score=1.0)
        assert mode.turn_number == n_turns + 1


# -- Sequence advancement ----------------------------------------------


class TestSequenceAdvancement:
    """current_index tracks through decision_sequence correctly."""

    @given(seq=decision_sequences(min_size=1, max_size=10))
    @settings(max_examples=200)
    def test_sequence_walks_then_returns_none(self, seq: list[str]) -> None:
        mode = _mode(seq=seq)
        for i, did in enumerate(seq):
            # Before closing, next should be current element
            assert mode.get_next_decision_id("prev") == did
            _close_v2(mode, did, selected_score=1.0, max_score=1.0)
        # After exhausting sequence, should return None
        assert mode.get_next_decision_id("last") is None

    @given(seq=decision_sequences(min_size=2, max_size=10))
    @settings(max_examples=100)
    def test_index_never_exceeds_sequence_length(self, seq: list[str]) -> None:
        mode = _mode(seq=seq)
        for did in seq:
            _close_v2(mode, did, selected_score=1.0, max_score=1.0)
        # Close extra times beyond sequence length
        _close_v2(mode, "extra1", selected_score=1.0, max_score=1.0)
        _close_v2(mode, "extra2", selected_score=1.0, max_score=1.0)
        assert mode.get_next_decision_id("any") is None


# -- Stress delta correctness ------------------------------------------


class TestStressDelta:
    """Stress changes correctly based on stress_delta from options."""

    @given(
        delta=stress_deltas(),
    )
    @settings(max_examples=200)
    def test_stress_changes_by_delta(
        self,
        delta: int,
    ) -> None:
        mode = _mode()
        mode.stress = 5  # start mid-range
        _close_v2(mode, "d0", selected_score=1.0, max_score=1.0, stress_delta=delta)
        expected = max(0, min(10, 5 + delta))
        assert mode.stress == expected

    @given(selected=scores())
    @settings(max_examples=200)
    def test_zero_delta_no_stress_change(
        self,
        selected: float,
    ) -> None:
        mode = _mode()
        initial_stress = mode.stress
        opts = [{"id": "a", "label": "A", "score": selected, "stress_delta": 0, "system_effects": [], "targets_system": False, "max_plays": 1, "role": None}]
        changes = mode.on_decision_closed_v2("d0", opts, opts)
        sc = next(c for c in changes if c["type"] == "score_change")
        assert sc["stress"] == initial_stress
        assert mode.stress == initial_stress


# -- Score change structure --------------------------------------------


class TestScoreChangeStructure:
    """on_decision_closed_v2 always returns at least one well-formed ScoreChange."""

    @given(selected=scores(), max_s=scores())
    @settings(max_examples=200)
    def test_returns_single_score_change(
        self,
        selected: float,
        max_s: float,
    ) -> None:
        assume(max_s >= selected)
        mode = _mode()
        changes = _close_v2(mode, "d0", selected_score=selected, max_score=max_s)
        score_changes = [c for c in changes if c["type"] == "score_change"]
        assert len(score_changes) == 1
        c = score_changes[0]
        assert "total_score" in c
        assert "stress" in c
        assert "next_decision_time_ms" in c
        assert "turn_number" in c


# -- Auto-submit picks worst ------------------------------------------


class TestAutoSubmitPicksWorst:
    """on_decision_timeout always returns the lowest-scoring option."""

    @given(options=option_lists(min_size=1, max_size=10))
    @settings(max_examples=200)
    def test_timeout_selects_min_score(self, options: list[dict]) -> None:
        mode = _mode()
        result = mode.on_decision_timeout("d0", options)
        min_score = min(o["score"] for o in options)
        selected_option = next(o for o in options if o["id"] == result)
        assert selected_option["score"] == min_score

    def test_timeout_empty_returns_none(self) -> None:
        mode = _mode()
        assert mode.on_decision_timeout("d0", []) is None


# -- Cumulative multi-turn integration ---------------------------------


class TestMultiTurnAccumulation:
    """Verify state consistency across a full sequence of turns."""

    @given(
        score_pairs=st.lists(
            st.tuples(scores(), scores()),
            min_size=1,
            max_size=15,
        ),
    )
    @settings(max_examples=200)
    def test_full_sequence_state_consistency(
        self,
        score_pairs: list[tuple[float, float]],
    ) -> None:
        # Normalize: ensure max >= selected
        pairs = [(sel, sel + gap) for sel, gap in score_pairs]
        seq = [f"d{i}" for i in range(len(pairs))]
        mode = _mode(seq=seq)

        expected_total = 0.0
        for i, (sel, max_s) in enumerate(pairs):
            changes = _close_v2(mode, f"d{i}", selected_score=sel, max_score=max_s)
            expected_total += sel

            assert abs(mode.total_score - expected_total) < 1e-6
            sc = next(c for c in changes if c["type"] == "score_change")
            assert sc["turn_number"] == i + 2

        assert mode.turn_number == len(pairs) + 1
        assert mode.current_index == len(pairs)
        assert mode.get_next_decision_id("done") is None


# -- V2 option-list scoring -----------------------------------------------


class TestV2ScoringFormula:
    """on_decision_closed_v2 computes correct selected/max scores."""

    @given(
        all_opts=signed_option_lists(min_size=2, max_size=6),
        n_selected=st.integers(min_value=1, max_value=3),
    )
    @settings(max_examples=200)
    def test_stress_is_clamped(
        self,
        all_opts: list[dict],
        n_selected: int,
    ) -> None:
        assume(n_selected <= len(all_opts))
        mode = _mode()
        selected = all_opts[:n_selected]
        changes = mode.on_decision_closed_v2("d0", selected, all_opts)
        score_change = next(c for c in changes if c["type"] == "score_change")
        assert 0 <= score_change["stress"] <= 10

    @given(
        all_opts=signed_option_lists(min_size=2, max_size=6),
        n_selected=st.integers(min_value=1, max_value=3),
    )
    @settings(max_examples=200)
    def test_total_score_equals_sum(
        self,
        all_opts: list[dict],
        n_selected: int,
    ) -> None:
        assume(n_selected <= len(all_opts))
        mode = _mode()
        selected = all_opts[:n_selected]
        changes = mode.on_decision_closed_v2("d0", selected, all_opts)
        score_change = next(c for c in changes if c["type"] == "score_change")
        expected = sum(o["score"] for o in selected)
        assert abs(score_change["total_score"] - expected) < 1e-6

    @given(all_opts=signed_option_lists(min_size=1, max_size=6))
    @settings(max_examples=100)
    def test_advances_turn(self, all_opts: list[dict]) -> None:
        mode = _mode()
        mode.on_decision_closed_v2("d0", [all_opts[0]], all_opts)
        assert mode.turn_number == 2


class TestV2TimerBounds:
    """Timer always returns a valid value with v2 scoring."""

    @given(
        all_opts=signed_option_lists(min_size=2, max_size=6),
        n_selected=st.integers(min_value=1, max_value=3),
    )
    @settings(max_examples=200)
    def test_decision_time_valid(
        self,
        all_opts: list[dict],
        n_selected: int,
    ) -> None:
        assume(n_selected <= len(all_opts))
        mode = _mode()
        mode.on_decision_closed_v2("d0", all_opts[:n_selected], all_opts)
        effective = mode.get_decision_time_ms(300_000)
        valid_times = set(STRESS_TIME_TABLE.values()) | {180_000}
        assert effective in valid_times


# -- Forced card property tests -------------------------------------------

# -- Snapshot consistency ------------------------------------------------


class TestSnapshotConsistency:
    """snapshot() reflects accumulated state accurately."""

    @given(
        score_pairs=st.lists(
            st.tuples(scores(), scores()),
            min_size=1,
            max_size=10,
        ),
    )
    @settings(max_examples=200)
    def test_snapshot_total_score_equals_sum(
        self,
        score_pairs: list[tuple[float, float]],
    ) -> None:
        pairs = [(sel, sel + gap) for sel, gap in score_pairs]
        seq = [f"d{i}" for i in range(len(pairs))]
        mode = _mode(seq=seq)
        expected_total = 0.0
        for i, (sel, max_s) in enumerate(pairs):
            _close_v2(mode, f"d{i}", selected_score=sel, max_score=max_s)
            expected_total += sel
        snap = mode.snapshot()
        assert snap is not None
        assert abs(snap["total_score"] - expected_total) < 1e-6

    @given(n_turns=st.integers(min_value=0, max_value=20))
    @settings(max_examples=100)
    def test_snapshot_turn_number(self, n_turns: int) -> None:
        mode = _mode(seq=[f"d{i}" for i in range(n_turns)])
        for i in range(n_turns):
            _close_v2(mode, f"d{i}", selected_score=1.0, max_score=1.0)
        snap = mode.snapshot()
        assert snap is not None
        assert snap["turn_number"] == n_turns + 1

    @given(
        deltas=st.lists(stress_deltas(), min_size=1, max_size=10),
    )
    @settings(max_examples=200)
    def test_snapshot_stress_matches_mode(
        self,
        deltas: list[int],
    ) -> None:
        seq = [f"d{i}" for i in range(len(deltas))]
        mode = _mode(seq=seq)
        for i, delta in enumerate(deltas):
            _close_v2(mode, f"d{i}", selected_score=0.0, max_score=1.0, stress_delta=delta)
        snap = mode.snapshot()
        assert snap is not None
        assert snap["stress"] == mode.stress


class TestForcedCardInvariant:
    """Forced cards always present in scoring, with correct change emitted."""

    @given(
        all_opts=signed_option_lists(min_size=3, max_size=6),
    )
    @settings(max_examples=200)
    def test_forced_card_always_scored(
        self,
        all_opts: list[dict],
    ) -> None:
        """If a forced card is NOT in selection, ForcedCardApplied is emitted."""
        assume(len(all_opts) >= 2)
        forced_id = all_opts[0]["id"]
        selected = [all_opts[1]]  # deliberately exclude forced
        mode = _mode()
        changes = mode.on_decision_closed_v2(
            "d0",
            selected,
            all_opts,
            forced_option_ids=[forced_id],
        )
        forced = [c for c in changes if c["type"] == "forced_card_applied"]
        assert len(forced) == 1
        assert forced[0]["forced_option_id"] == forced_id

    @given(
        all_opts=signed_option_lists(min_size=2, max_size=6),
    )
    @settings(max_examples=200)
    def test_forced_card_present_no_extra_change(
        self,
        all_opts: list[dict],
    ) -> None:
        """If forced card IS in selection, no ForcedCardApplied emitted."""
        forced_id = all_opts[0]["id"]
        selected = [all_opts[0]]  # includes forced
        mode = _mode()
        changes = mode.on_decision_closed_v2(
            "d0",
            selected,
            all_opts,
            forced_option_ids=[forced_id],
        )
        forced = [c for c in changes if c["type"] == "forced_card_applied"]
        assert len(forced) == 0

    @given(all_opts=signed_option_lists(min_size=2, max_size=6))
    @settings(max_examples=100)
    def test_no_forced_ids_no_forced_change(
        self,
        all_opts: list[dict],
    ) -> None:
        """No forced_option_ids -> no ForcedCardApplied."""
        mode = _mode()
        changes = mode.on_decision_closed_v2("d0", [all_opts[0]], all_opts)
        forced = [c for c in changes if c["type"] == "forced_card_applied"]
        assert len(forced) == 0
