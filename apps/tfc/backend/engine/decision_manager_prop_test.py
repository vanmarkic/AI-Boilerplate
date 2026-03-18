"""Property tests for DecisionManager — decision lifecycle invariants."""

from __future__ import annotations

from hypothesis import assume, given, settings
from hypothesis import strategies as st

from engine.decision_manager import DecisionManager
from engine.strategies import durations, monotonic_play_times, play_times


def _open(
    mgr: DecisionManager,
    did: str = "d0",
    pt: float = 0.0,
    timeout_ms: float = 0.0,
) -> dict:
    return mgr.open_decision(
        id=did,
        event_id="e0",
        issue_id="i0",
        title=f"Decision {did}",
        description=f"Desc {did}",
        question_type="single_choice",
        options=[{"id": "o1", "label": "Yes"}],
        completion_mode="first_response",
        target_roles=["player"],
        timeout_ms=timeout_ms,
        current_pt_ms=pt,
    )


class TestCloseIdempotent:
    """Closing a closed or nonexistent decision always returns None."""

    @given(pt_open=play_times(), pt_close=play_times(), pt_extra=play_times())
    @settings(max_examples=200)
    def test_double_close_returns_none(
        self,
        pt_open: float,
        pt_close: float,
        pt_extra: float,
    ) -> None:
        mgr = DecisionManager()
        _open(mgr, "d0", pt=pt_open)
        first = mgr.close_decision("d0", current_pt_ms=pt_close)
        assert first is not None
        second = mgr.close_decision("d0", current_pt_ms=pt_extra)
        assert second is None

    @given(did=st.text(min_size=1, max_size=10), pt=play_times())
    @settings(max_examples=100)
    def test_close_nonexistent_returns_none(self, did: str, pt: float) -> None:
        mgr = DecisionManager()
        assert mgr.close_decision(did, current_pt_ms=pt) is None


class TestOpenDecisionsCount:
    """get_open_decisions reflects exact open count after opens and closes."""

    @given(
        n_open=st.integers(min_value=1, max_value=20),
        n_close=st.integers(min_value=0, max_value=20),
    )
    @settings(max_examples=200)
    def test_open_count_tracks_correctly(
        self,
        n_open: int,
        n_close: int,
    ) -> None:
        mgr = DecisionManager()
        for i in range(n_open):
            _open(mgr, did=f"d{i}", pt=float(i))
        assert len(mgr.get_open_decisions()) == n_open
        closed = 0
        for i in range(min(n_close, n_open)):
            result = mgr.close_decision(f"d{i}", current_pt_ms=100.0)
            if result is not None:
                closed += 1
        assert len(mgr.get_open_decisions()) == n_open - closed


class TestTimeoutExpiry:
    """Decisions with timeout must close when enough play time elapses."""

    @given(
        timeout=durations(),
        open_pt=play_times(),
    )
    @settings(max_examples=200)
    def test_tick_closes_expired_decisions(
        self,
        timeout: float,
        open_pt: float,
    ) -> None:
        assume(open_pt + timeout + 1.0 < 1e8)  # avoid overflow
        mgr = DecisionManager()
        _open(mgr, "d0", pt=open_pt, timeout_ms=timeout)
        assert len(mgr.get_open_decisions()) == 1
        # Add 1ms past timeout to avoid float rounding at the exact boundary
        changes = mgr.tick(open_pt + timeout + 1.0)
        assert len(changes) >= 1
        assert all(c["type"] == "decision_closed" for c in changes)
        assert len(mgr.get_open_decisions()) == 0

    @given(
        timeout=durations(),
        open_pt=play_times(),
        tick_pt=play_times(),
    )
    @settings(max_examples=200)
    def test_tick_before_timeout_does_not_close(
        self,
        timeout: float,
        open_pt: float,
        tick_pt: float,
    ) -> None:
        assume(tick_pt < open_pt + timeout)
        mgr = DecisionManager()
        _open(mgr, "d0", pt=open_pt, timeout_ms=timeout)
        changes = mgr.tick(tick_pt)
        assert len(changes) == 0
        assert len(mgr.get_open_decisions()) == 1


class TestNoTimeoutNeverExpires:
    """Decisions with timeout_ms=0 are never closed by tick."""

    @given(ticks=monotonic_play_times(min_size=1, max_size=30))
    @settings(max_examples=100)
    def test_zero_timeout_never_expires(self, ticks: list[float]) -> None:
        mgr = DecisionManager()
        _open(mgr, "d0", pt=0.0, timeout_ms=0.0)
        for pt in ticks:
            changes = mgr.tick(pt)
            assert len(changes) == 0
        assert len(mgr.get_open_decisions()) == 1


class TestSnapshotCompleteness:
    """Snapshot always includes all decisions regardless of status."""

    @given(
        n_decisions=st.integers(min_value=0, max_value=15),
        n_close=st.integers(min_value=0, max_value=15),
    )
    @settings(max_examples=100)
    def test_snapshot_includes_all(
        self,
        n_decisions: int,
        n_close: int,
    ) -> None:
        mgr = DecisionManager()
        for i in range(n_decisions):
            _open(mgr, did=f"d{i}", pt=float(i))
        for i in range(min(n_close, n_decisions)):
            mgr.close_decision(f"d{i}", current_pt_ms=100.0)
        snap = mgr.snapshot()
        assert len(snap) == n_decisions


class TestClearRemovesAll:
    """clear() empties all tracked decisions."""

    @given(n=st.integers(min_value=1, max_value=20))
    @settings(max_examples=50)
    def test_clear_empties_state(self, n: int) -> None:
        mgr = DecisionManager()
        for i in range(n):
            _open(mgr, did=f"d{i}", pt=0.0)
        mgr.clear()
        assert len(mgr.get_open_decisions()) == 0
        assert len(mgr.snapshot()) == 0
