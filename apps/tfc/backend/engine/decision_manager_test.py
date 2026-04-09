"""Tests for DecisionManager — tracks in-flight decision points."""
from __future__ import annotations

import pytest

from engine.decision_manager import ActiveDecision, DecisionManager


def _decision_kwargs(
    id: str = "d1",
    inject_id: str | None = "e1",
    defect_id: str | None = "i1",
) -> dict:
    return {
        "id": id,
        "inject_id": inject_id,
        "defect_id": defect_id,
        "title": f"Decision {id}",
        "description": f"Desc {id}",
        "question_type": "single_choice",
        "options": [{"id": "o1", "label": "Yes", "score": 1.0}],
        "completion_mode": "first_response",
        "target_roles": ["player"],
    }


def test_open_decision_returns_change() -> None:
    mgr = DecisionManager()
    change = mgr.open_decision(current_pt_ms=1000.0, **_decision_kwargs())
    assert change["type"] == "decision_opened"
    assert change["decision_id"] == "d1"
    assert change["title"] == "Decision d1"
    assert len(mgr.get_open_decisions()) == 1


def test_close_decision_returns_change() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=1000.0, **_decision_kwargs())
    change = mgr.close_decision("d1", current_pt_ms=2000.0)
    assert change["type"] == "decision_closed"
    assert change["decision_id"] == "d1"
    assert len(mgr.get_open_decisions()) == 0


def test_get_open_decisions_filters_closed() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs(id="d1"))
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs(id="d2"))
    mgr.close_decision("d1", current_pt_ms=100.0)
    open_decisions = mgr.get_open_decisions()
    assert len(open_decisions) == 1
    assert open_decisions[0].id == "d2"


def test_snapshot_includes_all_decisions() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs(id="d1"))
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs(id="d2"))
    mgr.close_decision("d1", current_pt_ms=100.0)
    snap = mgr.snapshot()
    assert len(snap) == 2
    statuses = {d["id"]: d["status"] for d in snap}
    assert statuses["d1"] == "closed"
    assert statuses["d2"] == "open"


def test_close_nonexistent_decision_returns_none() -> None:
    mgr = DecisionManager()
    result = mgr.close_decision("nope", current_pt_ms=0.0)
    assert result is None
