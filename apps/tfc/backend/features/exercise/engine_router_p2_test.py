"""Tests for P2 engine_router additions: role-targeted broadcast splitting."""

from features.exercise.engine_broadcast import split_targeted_changes as _split_targeted_changes


def test_split_no_targeted_changes() -> None:
    changes = [
        {"type": "event_change", "event_id": "e1", "action": "started"},
        {"type": "phase_change", "phase": "running"},
    ]
    targeted, general = _split_targeted_changes(changes)
    assert len(targeted) == 0
    assert len(general) == 2


def test_split_decision_with_target_roles() -> None:
    changes = [
        {"type": "event_change", "event_id": "e1", "action": "started"},
        {
            "type": "decision_opened",
            "decision_id": "d1",
            "target_roles": ["player"],
        },
    ]
    targeted, general = _split_targeted_changes(changes)
    assert len(general) == 1
    assert general[0]["type"] == "event_change"
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
    targeted, _general = _split_targeted_changes(changes)
    assert len(targeted) == 1
    _roles, role_changes = targeted[0]
    assert len(role_changes) == 2


def test_split_different_roles_separate() -> None:
    changes = [
        {"type": "decision_opened", "decision_id": "d1", "target_roles": ["player"]},
        {"type": "decision_opened", "decision_id": "d2", "target_roles": ["observer"]},
    ]
    targeted, _general = _split_targeted_changes(changes)
    assert len(targeted) == 2


def test_split_event_change_with_target_roles() -> None:
    """Event changes with target_roles are role-targeted, not general."""
    changes = [
        {
            "type": "event_change",
            "event_id": "e1",
            "action": "started",
            "target_roles": ["cyop"],
            "role_descriptions": {"cyop": "Anomaly detected in IBMS."},
        },
        {"type": "phase_change", "phase": "running"},
    ]
    targeted, general = _split_targeted_changes(changes)
    assert len(general) == 1
    assert general[0]["type"] == "phase_change"
    assert len(targeted) == 1
    roles, role_changes = targeted[0]
    assert "cyop" in roles
    assert role_changes[0]["event_id"] == "e1"


def test_split_event_change_without_target_roles_is_general() -> None:
    """Event changes with empty target_roles broadcast to everyone."""
    changes = [
        {
            "type": "event_change",
            "event_id": "e1",
            "action": "started",
            "target_roles": [],
            "role_descriptions": {},
        },
    ]
    targeted, general = _split_targeted_changes(changes)
    assert len(targeted) == 0
    assert len(general) == 1


def test_split_mixed_decisions_and_events_with_roles() -> None:
    """Decisions and events with target_roles both get role-targeted."""
    changes = [
        {
            "type": "decision_opened",
            "decision_id": "d1",
            "target_roles": ["co", "nav"],
        },
        {
            "type": "event_change",
            "event_id": "e1",
            "action": "started",
            "target_roles": ["co", "nav"],
            "role_descriptions": {},
        },
        {
            "type": "event_change",
            "event_id": "e2",
            "action": "started",
            "target_roles": ["eo"],
            "role_descriptions": {"eo": "Component back online."},
        },
    ]
    targeted, general = _split_targeted_changes(changes)
    assert len(general) == 0
    assert len(targeted) == 2
    # co+nav group has both the decision and the event
    co_nav = next((t for t in targeted if "co" in t[0]), None)
    assert co_nav is not None
    assert len(co_nav[1]) == 2
    # eo group has just the event
    eo = next((t for t in targeted if "eo" in t[0]), None)
    assert eo is not None
    assert len(eo[1]) == 1
