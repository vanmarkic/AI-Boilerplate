"""Tests for P2 DecisionManager additions: timeout, tick, wall-clock tracking."""

from __future__ import annotations

from unittest.mock import patch

from engine.decision_manager import DecisionManager


def _decision_kwargs(
    id: str = "d1",
    timeout_ms: float = 0.0,
) -> dict:
    return {
        "id": id,
        "event_id": "e1",
        "issue_id": "i1",
        "title": f"Decision {id}",
        "description": f"Desc {id}",
        "question_type": "single_choice",
        "options": [
            {
                "id": "o1",
                "label": "Yes",
                "score": 1.0,
                "stress_delta": 0,
                "system_effects": [],
                "targets_system": False,
                "max_plays": 1,
                "role": None,
            }
        ],
        "completion_mode": "first_response",
        "target_roles": ["player"],
        "timeout_ms": timeout_ms,
    }


def test_open_decision_includes_timeout_ms() -> None:
    mgr = DecisionManager()
    change = mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs(timeout_ms=5000.0))
    assert change["timeout_ms"] == 5000.0


def test_open_decision_sets_wall_clock_time() -> None:
    mgr = DecisionManager()
    with patch("engine.decision_manager._time_mod.monotonic", return_value=100.0):
        mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs())
    d = mgr.get_open_decisions()[0]
    assert d.opened_at_rt_ms == 100_000.0  # monotonic * 1000


def test_tick_times_out_expired_decisions() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs(id="d1", timeout_ms=100.0))
    # Not yet timed out
    changes = mgr.tick(50.0)
    assert len(changes) == 0
    assert len(mgr.get_open_decisions()) == 1
    # Now timed out
    changes = mgr.tick(100.0)
    assert len(changes) == 1
    assert changes[0]["type"] == "decision_closed"
    assert changes[0]["decision_id"] == "d1"
    assert len(mgr.get_open_decisions()) == 0


def test_tick_ignores_no_timeout_decisions() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs(timeout_ms=0.0))
    changes = mgr.tick(999999.0)
    assert len(changes) == 0
    assert len(mgr.get_open_decisions()) == 1


def test_tick_ignores_already_closed() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs(timeout_ms=100.0))
    mgr.close_decision("d1", current_pt_ms=50.0)
    changes = mgr.tick(200.0)
    assert len(changes) == 0


def test_snapshot_includes_timeout_ms() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs(timeout_ms=3000.0))
    snap = mgr.snapshot()
    assert snap[0]["timeout_ms"] == 3000.0


def test_timed_out_status() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs(timeout_ms=100.0))
    mgr.tick(100.0)
    snap = mgr.snapshot()
    assert snap[0]["status"] == "timed_out"
