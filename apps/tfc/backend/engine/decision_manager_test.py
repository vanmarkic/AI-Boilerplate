"""Tests for DecisionManager — tracks in-flight decision points."""

from __future__ import annotations

from engine.decision_manager import DecisionManager


def _decision_kwargs(
    id: str = "d1",
    event_id: str | None = "e1",
    issue_id: str | None = "i1",
) -> dict:
    return {
        "id": id,
        "event_id": event_id,
        "issue_id": issue_id,
        "title": f"Decision {id}",
        "description": f"Desc {id}",
        "question_type": "single_choice",
        "options": [{"id": "o1", "label": "Yes", "score": 1.0, "stress_delta": 0, "system_effects": [], "targets_system": False, "max_plays": 1, "role": None}],
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


def test_submit_recommendation_stores_and_returns_change() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs())
    change = mgr.submit_recommendation("d1", "advisor-1", "o1")
    assert change is not None
    assert change["type"] == "recommendation_submitted"
    assert change["participant_id"] == "advisor-1"
    assert change["option_id"] == "o1"
    decision = mgr.get_open_decisions()[0]
    assert decision.recommendations["advisor-1"] == "o1"


def test_submit_recommendation_multiple_advisors() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs())
    mgr.submit_recommendation("d1", "advisor-1", "o1")
    mgr.submit_recommendation("d1", "advisor-2", "o1")
    decision = mgr.get_open_decisions()[0]
    assert len(decision.recommendations) == 2


def test_submit_recommendation_closed_decision_returns_none() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs())
    mgr.close_decision("d1", current_pt_ms=100.0)
    assert mgr.submit_recommendation("d1", "advisor-1", "o1") is None


def test_snapshot_includes_recommendations() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs())
    mgr.submit_recommendation("d1", "advisor-1", "o1")
    snap = mgr.snapshot()
    assert snap[0]["recommendations"] == {"advisor-1": "o1"}


def test_close_decision_stores_selected_option_ids() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs())
    mgr.close_decision("d1", current_pt_ms=100.0, selected_option_ids=["o1"])
    decision = mgr._decisions["d1"]
    assert decision.selected_option_ids == ["o1"]


def test_close_decision_change_includes_selected_option_ids() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs())
    change = mgr.close_decision("d1", current_pt_ms=100.0, selected_option_ids=["o1"])
    assert change is not None
    assert change["selected_option_ids"] == ["o1"]


def test_close_decision_defaults_empty_selected_option_ids() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs())
    mgr.close_decision("d1", current_pt_ms=100.0)
    decision = mgr._decisions["d1"]
    assert decision.selected_option_ids == []


def test_snapshot_includes_selected_option_ids() -> None:
    mgr = DecisionManager()
    opts = [
        {"id": "o1", "label": "Yes", "score": 10.0, "stress_delta": 0, "system_effects": [], "targets_system": False, "max_plays": 1, "role": None},
        {"id": "o2", "label": "No", "score": 3.0, "stress_delta": 0, "system_effects": [], "targets_system": False, "max_plays": 1, "role": None},
    ]
    mgr.open_decision(
        current_pt_ms=0.0,
        **{**_decision_kwargs(), "options": opts},
    )
    mgr.close_decision("d1", current_pt_ms=100.0, selected_option_ids=["o1"])
    snap = mgr.snapshot()
    assert snap[0]["selected_option_ids"] == ["o1"]
