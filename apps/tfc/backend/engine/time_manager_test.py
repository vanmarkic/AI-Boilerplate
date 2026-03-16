"""Tests for TimeManager dual-clock logic."""
from unittest.mock import patch

import pytest

from engine.time_manager import TimeManager


def _make_clock(start: float = 0.0):
    """Return a mock _now_ms that increments by a controllable amount."""
    state = {"now": start}

    def advance(delta: float) -> None:
        state["now"] += delta

    def now_ms() -> float:
        return state["now"]

    return now_ms, advance


class TestStartPauseResume:
    def test_starts_paused(self) -> None:
        tm = TimeManager()
        assert tm.paused is True

    @patch("engine.time_manager._now_ms", return_value=1000.0)
    def test_start_unpauses(self, _mock: object) -> None:
        tm = TimeManager()
        tm.start()
        assert tm.paused is False

    def test_pause_after_start(self) -> None:
        now_ms, advance = _make_clock(0.0)
        with patch("engine.time_manager._now_ms", side_effect=now_ms):
            tm = TimeManager()
            tm.start()
            advance(100.0)
            tm.pause()
            assert tm.paused is True

    def test_resume_unpauses(self) -> None:
        now_ms, advance = _make_clock(0.0)
        with patch("engine.time_manager._now_ms", side_effect=now_ms):
            tm = TimeManager()
            tm.start()
            advance(50.0)
            tm.pause()
            advance(50.0)
            tm.start()  # resume
            assert tm.paused is False


class TestTick:
    def test_tick_advances_play_time(self) -> None:
        now_ms, advance = _make_clock(0.0)
        with patch("engine.time_manager._now_ms", side_effect=now_ms):
            tm = TimeManager(factor=1.0)
            tm.start()
            advance(200.0)
            delta = tm.tick()
            assert delta == pytest.approx(200.0)
            assert tm.play_time_ms == pytest.approx(200.0)

    def test_factor_doubles_play_time(self) -> None:
        now_ms, advance = _make_clock(0.0)
        with patch("engine.time_manager._now_ms", side_effect=now_ms):
            tm = TimeManager(factor=2.0)
            tm.start()
            advance(100.0)
            delta = tm.tick()
            assert delta == pytest.approx(200.0)
            assert tm.play_time_ms == pytest.approx(200.0)

    def test_tick_while_paused_returns_zero(self) -> None:
        tm = TimeManager()
        delta = tm.tick()
        assert delta == 0.0
        assert tm.play_time_ms == 0.0


class TestReset:
    def test_reset_clears_everything(self) -> None:
        now_ms, advance = _make_clock(0.0)
        with patch("engine.time_manager._now_ms", side_effect=now_ms):
            tm = TimeManager()
            tm.start()
            advance(500.0)
            tm.tick()
            tm.reset()
            assert tm.play_time_ms == 0.0
            assert tm.real_time_ms == 0.0
            assert tm.paused is True


class TestSnapshot:
    def test_snapshot_returns_correct_dict(self) -> None:
        now_ms, advance = _make_clock(1000.0)
        with patch("engine.time_manager._now_ms", side_effect=now_ms):
            tm = TimeManager(factor=1.5)
            tm.start()
            advance(100.0)
            tm.tick()
            snap = tm.snapshot()
            assert snap["factor"] == 1.5
            assert snap["paused"] is False
            assert snap["play_time_ms"] == pytest.approx(150.0)
            assert "real_time_ms" in snap


class TestFactorValidation:
    def test_factor_must_be_positive(self) -> None:
        tm = TimeManager()
        with pytest.raises(ValueError, match="positive"):
            tm.factor = 0
        with pytest.raises(ValueError, match="positive"):
            tm.factor = -1.0
