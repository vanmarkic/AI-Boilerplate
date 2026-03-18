"""Property tests for TimeManager dual-clock logic."""

from __future__ import annotations

from collections.abc import Callable
from unittest.mock import patch

from hypothesis import given, settings
from hypothesis import strategies as st

from engine.strategies import speed_factors
from engine.time_manager import TimeManager


def _make_clock(start: float = 0.0) -> tuple[Callable[[], float], Callable[[float], None]]:
    """Return a controllable clock for deterministic testing."""
    state = {"now": start}

    def advance(delta: float) -> None:
        state["now"] += delta

    def now_ms() -> float:
        return state["now"]

    return now_ms, advance


class TestPlayTimeMonotonicity:
    """Play time must never decrease regardless of operations."""

    @given(
        factor=speed_factors(),
        actions=st.lists(
            st.sampled_from(["tick", "pause", "start"]),
            min_size=1,
            max_size=50,
        ),
        deltas=st.lists(
            st.floats(min_value=0.0, max_value=1000.0, allow_nan=False, allow_infinity=False),
            min_size=50,
            max_size=50,
        ),
    )
    @settings(max_examples=200)
    def test_play_time_never_decreases(
        self,
        factor: float,
        actions: list[str],
        deltas: list[float],
    ) -> None:
        now_ms, advance = _make_clock(0.0)
        with patch("engine.time_manager._now_ms", side_effect=now_ms):
            tm = TimeManager(factor=factor)
            tm.start()
            prev = 0.0
            for i, action in enumerate(actions):
                advance(deltas[i % len(deltas)])
                if action == "tick":
                    tm.tick()
                elif action == "pause":
                    tm.pause()
                elif action == "start":
                    tm.start()
                assert tm.play_time_ms >= prev, (
                    f"Play time decreased from {prev} to {tm.play_time_ms} after action={action}"
                )
                prev = tm.play_time_ms


class TestFactorScaling:
    """tick() delta must equal elapsed_real * factor."""

    @given(
        factor=speed_factors(),
        elapsed=st.floats(min_value=0.0, max_value=1e6, allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=200)
    def test_tick_delta_equals_elapsed_times_factor(
        self,
        factor: float,
        elapsed: float,
    ) -> None:
        now_ms, advance = _make_clock(0.0)
        with patch("engine.time_manager._now_ms", side_effect=now_ms):
            tm = TimeManager(factor=factor)
            tm.start()
            advance(elapsed)
            delta = tm.tick()
            expected = elapsed * factor
            assert (
                abs(delta - expected) < 1e-6 or abs(delta - expected) / max(expected, 1e-12) < 1e-6
            )


class TestPauseIdempotency:
    """Multiple pauses followed by tick should always yield zero delta."""

    @given(
        n_pauses=st.integers(min_value=1, max_value=10),
        elapsed_before=st.floats(
            min_value=0.0, max_value=1e4, allow_nan=False, allow_infinity=False
        ),
        elapsed_during=st.floats(
            min_value=0.0, max_value=1e4, allow_nan=False, allow_infinity=False
        ),
    )
    @settings(max_examples=100)
    def test_paused_tick_returns_zero(
        self,
        n_pauses: int,
        elapsed_before: float,
        elapsed_during: float,
    ) -> None:
        now_ms, advance = _make_clock(0.0)
        with patch("engine.time_manager._now_ms", side_effect=now_ms):
            tm = TimeManager(factor=1.0)
            tm.start()
            advance(elapsed_before)
            tm.tick()
            pt_before = tm.play_time_ms
            for _ in range(n_pauses):
                tm.pause()
            advance(elapsed_during)
            delta = tm.tick()
            assert delta == 0.0
            assert tm.play_time_ms == pt_before


class TestResetInvariant:
    """Reset always returns to pristine state."""

    @given(
        factor=speed_factors(),
        actions=st.lists(
            st.sampled_from(["tick", "pause", "start"]),
            min_size=1,
            max_size=20,
        ),
        deltas=st.lists(
            st.floats(min_value=0.0, max_value=1000.0, allow_nan=False, allow_infinity=False),
            min_size=20,
            max_size=20,
        ),
    )
    @settings(max_examples=100)
    def test_reset_zeroes_all_state(
        self,
        factor: float,
        actions: list[str],
        deltas: list[float],
    ) -> None:
        now_ms, advance = _make_clock(0.0)
        with patch("engine.time_manager._now_ms", side_effect=now_ms):
            tm = TimeManager(factor=factor)
            tm.start()
            for i, action in enumerate(actions):
                advance(deltas[i % len(deltas)])
                getattr(tm, action)() if action != "tick" else tm.tick()
            tm.reset()
            assert tm.play_time_ms == 0.0
            assert tm.real_time_ms == 0.0
            assert tm.paused is True


class TestSnapshotSerializable:
    """Snapshot must always contain the expected keys with valid types."""

    @given(factor=speed_factors())
    @settings(max_examples=50)
    def test_snapshot_keys_and_types(self, factor: float) -> None:
        now_ms, advance = _make_clock(0.0)
        with patch("engine.time_manager._now_ms", side_effect=now_ms):
            tm = TimeManager(factor=factor)
            tm.start()
            advance(100.0)
            tm.tick()
            snap = tm.snapshot()
            assert isinstance(snap["play_time_ms"], float)
            assert isinstance(snap["real_time_ms"], float)
            assert isinstance(snap["factor"], float)
            assert isinstance(snap["paused"], bool)
