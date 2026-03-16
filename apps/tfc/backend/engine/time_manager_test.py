"""Tests for TimeManager dual-clock logic."""
from unittest.mock import patch

import pytest

from engine.time_manager import TimeManager


def _make_tm(factor: float = 1.0) -> TimeManager:
    return TimeManager(factor=factor)


class TestStartPauseResume:
    @patch("engine.time_manager._now_ms", side_effect=[1000.0, 1100.0, 1100.0])
    def test_start_unpauses(self, _mock):
        tm = _make_tm()
        assert tm.paused is True
        tm.start()
        assert tm.paused is False

    @patch("engine.time_manager._now_ms", side_effect=[1000.0, 1100.0, 1100.0, 1100.0])
    def test_pause_captures_remaining_time(self, _mock):
        tm = _make_tm()
        tm.start()        # _now_ms -> 1000
        tm.pause()        # tick() -> _now_ms 1100, then paused
        assert tm.paused is True
        assert tm.play_time_ms == 100.0

    @patch(
        "engine.time_manager._now_ms",
        side_effect=[1000.0, 1100.0, 1100.0, 1200.0, 1300.0],
    )
    def test_resume_continues(self, _mock):
        tm = _make_tm()
        tm.start()       # 1000
        tm.pause()       # tick->1100, pause
        tm.start()       # resume at 1200
        delta = tm.tick() # 1300
        assert delta == 100.0
        assert tm.play_time_ms == 200.0


class TestTick:
    @patch("engine.time_manager._now_ms", side_effect=[1000.0, 1500.0])
    def test_tick_advances_play_time(self, _mock):
        tm = _make_tm()
        tm.start()
        delta = tm.tick()
        assert delta == 500.0
        assert tm.play_time_ms == 500.0

    @patch("engine.time_manager._now_ms", side_effect=[1000.0, 1500.0])
    def test_factor_doubles_play_time(self, _mock):
        tm = _make_tm(factor=2.0)
        tm.start()
        delta = tm.tick()
        assert delta == 1000.0
        assert tm.play_time_ms == 1000.0

    def test_tick_while_paused_returns_zero(self):
        tm = _make_tm()
        assert tm.tick() == 0.0
        assert tm.play_time_ms == 0.0


class TestReset:
    @patch("engine.time_manager._now_ms", side_effect=[1000.0, 1500.0])
    def test_reset_clears_everything(self, _mock):
        tm = _make_tm()
        tm.start()
        tm.tick()
        tm.reset()
        assert tm.play_time_ms == 0.0
        assert tm.paused is True
        assert tm.real_time_ms == 0.0


class TestSnapshot:
    @patch("engine.time_manager._now_ms", side_effect=[1000.0, 1500.0, 1500.0])
    def test_snapshot_returns_correct_dict(self, _mock):
        tm = _make_tm(factor=1.5)
        tm.start()
        tm.tick()
        snap = tm.snapshot()
        assert snap["play_time_ms"] == 750.0
        assert snap["factor"] == 1.5
        assert snap["paused"] is False
        assert "real_time_ms" in snap


class TestFactorValidation:
    def test_factor_must_be_positive(self):
        tm = _make_tm()
        with pytest.raises(ValueError, match="positive"):
            tm.factor = 0.0

    def test_negative_factor_raises(self):
        tm = _make_tm()
        with pytest.raises(ValueError, match="positive"):
            tm.factor = -1.0
