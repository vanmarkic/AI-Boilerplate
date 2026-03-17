"""Property tests for SimpleCollaborativeMode.

Invariants tested:
- Score monotonicity: total_score never decreases across turns.
- Penalty monotonicity: accumulated_penalty_ms never decreases.
- Timer floor: effective decision time >= min_decision_time_ms.
- Turn counting: turn_number == number of on_decision_closed calls.
- Sequence advancement: current_index tracks correctly, None at end.
- Penalty formula: penalty_ms == (max - selected) * factor * 1000.
- Perfect score: selected == max → zero penalty delta.
- Auto-submit: timeout always picks the min-score option.
"""
from __future__ import annotations

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from engine.game_modes.simple_collaborative import SimpleCollaborativeMode
from engine.strategies import (
    decision_sequences,
    durations,
    option_lists,
    penalty_factors,
    scores,
)


def _mode(
    seq: list[str] | None = None,
    base_time: int = 300_000,
    penalty_factor: float = 0.1,
    min_time: int = 30_000,
) -> SimpleCollaborativeMode:
    return SimpleCollaborativeMode(
        decision_sequence=seq or ["d0", "d1", "d2"],
        base_decision_time_ms=base_time,
        penalty_factor=penalty_factor,
        min_decision_time_ms=min_time,
    )


# -- Score monotonicity ------------------------------------------------

class TestScoreMonotonicity:
    """total_score can only increase or stay the same."""

    @given(
        selected_scores=st.lists(
            scores(), min_size=2, max_size=20,
        ),
    )
    @settings(max_examples=200)
    def test_total_score_never_decreases(
        self, selected_scores: list[float],
    ) -> None:
        mode = _mode(seq=[f"d{i}" for i in range(len(selected_scores))])
        prev_total = 0.0
        for i, sel in enumerate(selected_scores):
            max_s = sel + 1.0  # ensure max >= selected
            mode.on_decision_closed(f"d{i}", selected_score=sel, max_score=max_s)
            assert mode.total_score >= prev_total
            prev_total = mode.total_score


# -- Penalty monotonicity ----------------------------------------------

class TestPenaltyMonotonicity:
    """accumulated_penalty_ms can only increase or stay the same."""

    @given(
        gaps=st.lists(
            scores(), min_size=2, max_size=20,
        ),
    )
    @settings(max_examples=200)
    def test_penalty_never_decreases(self, gaps: list[float]) -> None:
        mode = _mode(seq=[f"d{i}" for i in range(len(gaps))])
        prev_penalty = 0.0
        for i, gap in enumerate(gaps):
            mode.on_decision_closed(
                f"d{i}", selected_score=0.0, max_score=gap,
            )
            assert mode.accumulated_penalty_ms >= prev_penalty
            prev_penalty = mode.accumulated_penalty_ms


# -- Timer floor -------------------------------------------------------

class TestTimerFloor:
    """Effective decision time never drops below min_decision_time_ms."""

    @given(
        base_time=st.integers(min_value=10_000, max_value=600_000),
        min_time=st.integers(min_value=1_000, max_value=60_000),
        penalty=st.floats(
            min_value=0.0, max_value=1e9,
            allow_nan=False, allow_infinity=False,
        ),
    )
    @settings(max_examples=300)
    def test_decision_time_at_least_minimum(
        self, base_time: int, min_time: int, penalty: float,
    ) -> None:
        assume(min_time <= base_time)
        mode = _mode(base_time=base_time, min_time=min_time)
        mode.accumulated_penalty_ms = penalty
        effective = mode.get_decision_time_ms(base_time)
        assert effective >= min_time

    @given(
        base_time=st.integers(min_value=10_000, max_value=600_000),
        min_time=st.integers(min_value=1_000, max_value=60_000),
    )
    @settings(max_examples=100)
    def test_zero_penalty_gives_base_time(
        self, base_time: int, min_time: int,
    ) -> None:
        assume(min_time <= base_time)
        mode = _mode(base_time=base_time, min_time=min_time)
        assert mode.get_decision_time_ms(base_time) == base_time


# -- Turn counting -----------------------------------------------------

class TestTurnCounting:
    """turn_number equals the number of on_decision_closed calls."""

    @given(n_turns=st.integers(min_value=0, max_value=30))
    @settings(max_examples=100)
    def test_turn_number_matches_close_count(self, n_turns: int) -> None:
        mode = _mode(seq=[f"d{i}" for i in range(n_turns)])
        for i in range(n_turns):
            mode.on_decision_closed(f"d{i}", selected_score=1.0, max_score=1.0)
        assert mode.turn_number == n_turns


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
            mode.on_decision_closed(did, selected_score=1.0, max_score=1.0)
        # After exhausting sequence, should return None
        assert mode.get_next_decision_id("last") is None

    @given(seq=decision_sequences(min_size=2, max_size=10))
    @settings(max_examples=100)
    def test_index_never_exceeds_sequence_length(self, seq: list[str]) -> None:
        mode = _mode(seq=seq)
        for did in seq:
            mode.on_decision_closed(did, selected_score=1.0, max_score=1.0)
        # Close extra times beyond sequence length
        mode.on_decision_closed("extra1", selected_score=1.0, max_score=1.0)
        mode.on_decision_closed("extra2", selected_score=1.0, max_score=1.0)
        assert mode.get_next_decision_id("any") is None


# -- Penalty formula correctness ---------------------------------------

class TestPenaltyFormula:
    """penalty_ms == (max_score - selected_score) * penalty_factor * 1000."""

    @given(
        selected=scores(),
        gap=scores(),
        factor=penalty_factors(),
    )
    @settings(max_examples=300)
    def test_penalty_matches_formula(
        self, selected: float, gap: float, factor: float,
    ) -> None:
        max_score = selected + gap
        mode = _mode(penalty_factor=factor)
        changes = mode.on_decision_closed(
            "d0", selected_score=selected, max_score=max_score,
        )
        expected_penalty = gap * factor * 1000
        assert abs(changes[0]["penalty_ms"] - expected_penalty) < 1e-6

    @given(selected=scores(), factor=penalty_factors())
    @settings(max_examples=200)
    def test_perfect_score_zero_penalty(
        self, selected: float, factor: float,
    ) -> None:
        mode = _mode(penalty_factor=factor)
        changes = mode.on_decision_closed(
            "d0", selected_score=selected, max_score=selected,
        )
        assert changes[0]["penalty_ms"] == 0.0
        assert mode.accumulated_penalty_ms == 0.0


# -- Score change structure --------------------------------------------

class TestScoreChangeStructure:
    """on_decision_closed always returns exactly one well-formed ScoreChange."""

    @given(selected=scores(), max_s=scores())
    @settings(max_examples=200)
    def test_returns_single_score_change(
        self, selected: float, max_s: float,
    ) -> None:
        assume(max_s >= selected)
        mode = _mode()
        changes = mode.on_decision_closed(
            "d0", selected_score=selected, max_score=max_s,
        )
        assert len(changes) == 1
        c = changes[0]
        assert c["type"] == "score_change"
        assert "total_score" in c
        assert "penalty_ms" in c
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
        factor=penalty_factors(),
    )
    @settings(max_examples=200)
    def test_full_sequence_state_consistency(
        self,
        score_pairs: list[tuple[float, float]],
        factor: float,
    ) -> None:
        # Normalize: ensure max >= selected
        pairs = [(sel, sel + gap) for sel, gap in score_pairs]
        seq = [f"d{i}" for i in range(len(pairs))]
        mode = _mode(seq=seq, penalty_factor=factor)

        expected_total = 0.0
        expected_penalty = 0.0
        for i, (sel, max_s) in enumerate(pairs):
            changes = mode.on_decision_closed(
                f"d{i}", selected_score=sel, max_score=max_s,
            )
            expected_total += sel
            expected_penalty += (max_s - sel) * factor * 1000

            assert abs(mode.total_score - expected_total) < 1e-6
            assert abs(mode.accumulated_penalty_ms - expected_penalty) < 1e-6
            assert changes[0]["turn_number"] == i + 1

        assert mode.turn_number == len(pairs)
        assert mode.current_index == len(pairs)
        assert mode.get_next_decision_id("done") is None
