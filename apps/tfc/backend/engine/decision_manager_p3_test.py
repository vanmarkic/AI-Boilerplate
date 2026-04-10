"""Tests for P3 DecisionManager additions: all_respond completion mode."""
from __future__ import annotations

from engine.decision_manager import DecisionManager


def _decision_kwargs(
    id: str = "d1",
    completion_mode: str = "all_respond",
    target_roles: list[str] | None = None,
) -> dict:
    return {
        "id": id,
        "inject_id": "e1",
        "defect_id": "i1",
        "title": f"Decision {id}",
        "description": f"Desc {id}",
        "question_type": "single_choice",
        "options": [{"id": "o1", "label": "Yes", "score": 1.0}],
        "completion_mode": completion_mode,
        "target_roles": target_roles if target_roles is not None else ["alpha", "bravo"],
        "timeout_ms": 0.0,
    }


# ── all_target_roles_responded ────────────────────────────────────────────


def test_all_respond_returns_false_when_no_recommendations() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs())
    assert mgr.all_target_roles_responded("d1") is False


def test_all_respond_returns_false_when_only_some_roles_responded() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs())
    mgr.record_recommendation("d1", role="alpha", participant_id="u1")
    assert mgr.all_target_roles_responded("d1") is False


def test_all_respond_returns_true_when_all_roles_responded() -> None:
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs())
    mgr.record_recommendation("d1", role="alpha", participant_id="u1")
    mgr.record_recommendation("d1", role="bravo", participant_id="u2")
    assert mgr.all_target_roles_responded("d1") is True


def test_all_respond_with_empty_target_roles_returns_false() -> None:
    """Edge case: no target roles means nothing to satisfy — stays open."""
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs(target_roles=[]))
    assert mgr.all_target_roles_responded("d1") is False


def test_all_respond_with_unknown_decision_returns_false() -> None:
    mgr = DecisionManager()
    assert mgr.all_target_roles_responded("nonexistent") is False


def test_all_respond_multiple_submissions_from_same_role_still_false() -> None:
    """Multiple responses from one role do not satisfy all roles."""
    mgr = DecisionManager()
    mgr.open_decision(current_pt_ms=0.0, **_decision_kwargs())
    mgr.record_recommendation("d1", role="alpha", participant_id="u1")
    mgr.record_recommendation("d1", role="alpha", participant_id="u2")
    assert mgr.all_target_roles_responded("d1") is False


def test_record_recommendation_on_unknown_decision_is_noop() -> None:
    """Recording to a non-existent decision should not raise."""
    mgr = DecisionManager()
    mgr.record_recommendation("ghost", role="alpha", participant_id="u1")


# ── auto-close integration ────────────────────────────────────────────────


def test_all_respond_single_role_auto_closes_after_one_response() -> None:
    mgr = DecisionManager()
    mgr.open_decision(
        current_pt_ms=0.0,
        **_decision_kwargs(target_roles=["solo"]),
    )
    mgr.record_recommendation("d1", role="solo", participant_id="u1")
    assert mgr.all_target_roles_responded("d1") is True
