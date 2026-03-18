"""Tests for ClassicMode — verifies default GM-driven behaviour."""

from __future__ import annotations

from engine.game_modes.classic import ClassicMode


def test_should_pause_on_decision() -> None:
    mode = ClassicMode()
    assert mode.should_pause_on_decision() is True


def test_on_decision_timeout_returns_none() -> None:
    mode = ClassicMode()
    options = [{"id": "o1", "label": "Yes", "score": 1.0}]
    assert mode.on_decision_timeout("d1", options) is None


def test_on_decision_closed_v2_returns_empty() -> None:
    mode = ClassicMode()
    opts = [{"id": "o1", "label": "Yes", "score": 1.0}]
    assert mode.on_decision_closed_v2("d1", opts, opts) == []


def test_get_next_decision_id_returns_none() -> None:
    mode = ClassicMode()
    assert mode.get_next_decision_id("d1") is None


def test_get_decision_time_ms_passthrough() -> None:
    mode = ClassicMode()
    assert mode.get_decision_time_ms(300_000) == 300_000


def test_requires_gm() -> None:
    mode = ClassicMode()
    assert mode.requires_gm() is True


def test_snapshot_returns_none() -> None:
    mode = ClassicMode()
    assert mode.snapshot() is None
