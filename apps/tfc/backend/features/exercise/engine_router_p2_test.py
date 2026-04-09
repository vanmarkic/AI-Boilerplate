"""Tests for P2 engine_router additions: role-targeted broadcast splitting."""
from features.exercise.engine_router import _split_targeted_changes


def test_split_no_targeted_changes() -> None:
    changes = [
        {"type": "inject_change", "inject_id": "e1", "action": "started"},
        {"type": "phase_change", "phase": "running"},
    ]
    targeted, general = _split_targeted_changes(changes)
    assert len(targeted) == 0
    assert len(general) == 2


def test_split_decision_with_target_roles() -> None:
    changes = [
        {"type": "inject_change", "inject_id": "e1", "action": "started"},
        {
            "type": "decision_opened", "decision_id": "d1",
            "target_roles": ["player"],
        },
    ]
    targeted, general = _split_targeted_changes(changes)
    assert len(general) == 1
    assert general[0]["type"] == "inject_change"
    assert len(targeted) == 1
    roles, role_changes = targeted[0]
    assert "player" in roles
    assert role_changes[0]["decision_id"] == "d1"


def test_split_decision_without_target_roles_is_general() -> None:
    changes = [
        {"type": "decision_opened", "decision_id": "d1", "target_roles": []},
    ]
    targeted, general = _split_targeted_changes(changes)
    assert len(targeted) == 0
    assert len(general) == 1


def test_split_groups_same_roles() -> None:
    changes = [
        {"type": "decision_opened", "decision_id": "d1", "target_roles": ["player"]},
        {"type": "decision_opened", "decision_id": "d2", "target_roles": ["player"]},
    ]
    targeted, general = _split_targeted_changes(changes)
    assert len(targeted) == 1
    roles, role_changes = targeted[0]
    assert len(role_changes) == 2


def test_split_different_roles_separate() -> None:
    changes = [
        {"type": "decision_opened", "decision_id": "d1", "target_roles": ["player"]},
        {"type": "decision_opened", "decision_id": "d2", "target_roles": ["observer"]},
    ]
    targeted, general = _split_targeted_changes(changes)
    assert len(targeted) == 2
