"""Exhaustive tests for WaitingRoomStore in-memory participant management.

Tests written first (TDD) — covers all store operations, edge cases,
and data integrity guarantees.
"""
from __future__ import annotations

import pytest

from features.waiting_room.waiting_room_store import (
    WaitingRoomParticipant,
    WaitingRoomStore,
    waiting_room_store,
)


# ── Helpers ──────────────────────────────────────────────────────────────


def _fresh_store() -> WaitingRoomStore:
    return WaitingRoomStore()


# ── WaitingRoomParticipant ───────────────────────────────────────────────


class TestParticipantCreate:
    def test_create_assigns_uuid(self) -> None:
        p = WaitingRoomParticipant.create("Alice", "player")
        assert len(p.id) == 36  # UUID4 format

    def test_create_sets_display_name(self) -> None:
        p = WaitingRoomParticipant.create("Bob", "observer")
        assert p.display_name == "Bob"

    def test_create_sets_role(self) -> None:
        p = WaitingRoomParticipant.create("Carol", "soc-analyst")
        assert p.role == "soc-analyst"

    def test_create_sets_joined_at_iso(self) -> None:
        p = WaitingRoomParticipant.create("Dave", "player")
        assert "T" in p.joined_at  # ISO format contains T

    def test_create_unique_ids(self) -> None:
        p1 = WaitingRoomParticipant.create("A", "player")
        p2 = WaitingRoomParticipant.create("B", "player")
        assert p1.id != p2.id


class TestParticipantToDict:
    def test_to_dict_includes_all_fields(self) -> None:
        p = WaitingRoomParticipant.create("Eve", "observer")
        d = p.to_dict()
        assert d["id"] == p.id
        assert d["display_name"] == "Eve"
        assert d["role"] == "observer"
        assert d["joined_at"] == p.joined_at

    def test_to_dict_returns_new_dict_each_call(self) -> None:
        p = WaitingRoomParticipant.create("Frank", "player")
        d1 = p.to_dict()
        d2 = p.to_dict()
        assert d1 == d2
        assert d1 is not d2


# ── Join ─────────────────────────────────────────────────────────────────


class TestJoin:
    def test_join_returns_participant(self) -> None:
        store = _fresh_store()
        p = store.join(1, "Alice", "player")
        assert isinstance(p, WaitingRoomParticipant)
        assert p.display_name == "Alice"
        assert p.role == "player"

    def test_join_creates_room_on_first_join(self) -> None:
        store = _fresh_store()
        store.join(1, "Alice", "player")
        assert len(store.list_participants(1)) == 1

    def test_join_multiple_participants(self) -> None:
        store = _fresh_store()
        store.join(1, "Alice", "player")
        store.join(1, "Bob", "observer")
        store.join(1, "Carol", "game-master")
        assert len(store.list_participants(1)) == 3

    def test_join_separate_exercises(self) -> None:
        store = _fresh_store()
        store.join(1, "Alice", "player")
        store.join(2, "Bob", "observer")
        assert len(store.list_participants(1)) == 1
        assert len(store.list_participants(2)) == 1

    def test_join_preserves_order(self) -> None:
        store = _fresh_store()
        store.join(1, "Alice", "player")
        store.join(1, "Bob", "observer")
        store.join(1, "Carol", "game-master")
        names = [p.display_name for p in store.list_participants(1)]
        assert names == ["Alice", "Bob", "Carol"]

    def test_join_same_name_allowed(self) -> None:
        store = _fresh_store()
        p1 = store.join(1, "Alice", "player")
        p2 = store.join(1, "Alice", "observer")
        assert p1.id != p2.id
        assert len(store.list_participants(1)) == 2


# ── Leave ────────────────────────────────────────────────────────────────


class TestLeave:
    def test_leave_returns_true_when_found(self) -> None:
        store = _fresh_store()
        p = store.join(1, "Alice", "player")
        assert store.leave(1, p.id) is True

    def test_leave_removes_participant(self) -> None:
        store = _fresh_store()
        p = store.join(1, "Alice", "player")
        store.leave(1, p.id)
        assert len(store.list_participants(1)) == 0

    def test_leave_returns_false_for_unknown_participant(self) -> None:
        store = _fresh_store()
        store.join(1, "Alice", "player")
        assert store.leave(1, "nonexistent-id") is False

    def test_leave_returns_false_for_unknown_exercise(self) -> None:
        store = _fresh_store()
        assert store.leave(999, "any-id") is False

    def test_leave_does_not_affect_others(self) -> None:
        store = _fresh_store()
        p1 = store.join(1, "Alice", "player")
        p2 = store.join(1, "Bob", "observer")
        store.leave(1, p1.id)
        remaining = store.list_participants(1)
        assert len(remaining) == 1
        assert remaining[0].id == p2.id

    def test_leave_cleans_up_empty_room(self) -> None:
        store = _fresh_store()
        p = store.join(1, "Alice", "player")
        store.leave(1, p.id)
        # Room should be cleaned up internally
        assert store.list_participants(1) == []

    def test_leave_twice_returns_false_second_time(self) -> None:
        store = _fresh_store()
        p = store.join(1, "Alice", "player")
        assert store.leave(1, p.id) is True
        assert store.leave(1, p.id) is False

    def test_leave_wrong_exercise_returns_false(self) -> None:
        store = _fresh_store()
        p = store.join(1, "Alice", "player")
        assert store.leave(2, p.id) is False


# ── Update Role ──────────────────────────────────────────────────────────


class TestUpdateRole:
    def test_update_role_returns_participant(self) -> None:
        store = _fresh_store()
        p = store.join(1, "Alice", "player")
        updated = store.update_role(1, p.id, "game-master")
        assert updated is not None
        assert updated.role == "game-master"

    def test_update_role_persists(self) -> None:
        store = _fresh_store()
        p = store.join(1, "Alice", "player")
        store.update_role(1, p.id, "observer")
        fetched = store.get_participant(1, p.id)
        assert fetched is not None
        assert fetched.role == "observer"

    def test_update_role_unknown_participant_returns_none(self) -> None:
        store = _fresh_store()
        store.join(1, "Alice", "player")
        assert store.update_role(1, "nonexistent", "observer") is None

    def test_update_role_unknown_exercise_returns_none(self) -> None:
        store = _fresh_store()
        assert store.update_role(999, "any-id", "observer") is None

    def test_update_role_does_not_affect_others(self) -> None:
        store = _fresh_store()
        p1 = store.join(1, "Alice", "player")
        p2 = store.join(1, "Bob", "player")
        store.update_role(1, p1.id, "game-master")
        assert store.get_participant(1, p2.id).role == "player"  # type: ignore[union-attr]

    def test_update_role_same_role_is_noop(self) -> None:
        store = _fresh_store()
        p = store.join(1, "Alice", "player")
        updated = store.update_role(1, p.id, "player")
        assert updated is not None
        assert updated.role == "player"

    def test_update_role_multiple_times(self) -> None:
        store = _fresh_store()
        p = store.join(1, "Alice", "player")
        store.update_role(1, p.id, "observer")
        store.update_role(1, p.id, "game-master")
        store.update_role(1, p.id, "soc-analyst")
        assert store.get_participant(1, p.id).role == "soc-analyst"  # type: ignore[union-attr]


# ── List Participants ────────────────────────────────────────────────────


class TestListParticipants:
    def test_list_empty_exercise(self) -> None:
        store = _fresh_store()
        assert store.list_participants(1) == []

    def test_list_returns_copies(self) -> None:
        store = _fresh_store()
        store.join(1, "Alice", "player")
        list1 = store.list_participants(1)
        list2 = store.list_participants(1)
        assert list1 is not list2

    def test_list_does_not_cross_exercises(self) -> None:
        store = _fresh_store()
        store.join(1, "Alice", "player")
        store.join(2, "Bob", "observer")
        assert len(store.list_participants(1)) == 1
        assert store.list_participants(1)[0].display_name == "Alice"


# ── Get Participant ──────────────────────────────────────────────────────


class TestGetParticipant:
    def test_get_existing(self) -> None:
        store = _fresh_store()
        p = store.join(1, "Alice", "player")
        fetched = store.get_participant(1, p.id)
        assert fetched is not None
        assert fetched.id == p.id
        assert fetched.display_name == "Alice"

    def test_get_unknown_participant(self) -> None:
        store = _fresh_store()
        store.join(1, "Alice", "player")
        assert store.get_participant(1, "nonexistent") is None

    def test_get_unknown_exercise(self) -> None:
        store = _fresh_store()
        assert store.get_participant(999, "any") is None

    def test_get_wrong_exercise(self) -> None:
        store = _fresh_store()
        p = store.join(1, "Alice", "player")
        assert store.get_participant(2, p.id) is None


# ── Clear ────────────────────────────────────────────────────────────────


class TestClear:
    def test_clear_removes_all_participants(self) -> None:
        store = _fresh_store()
        store.join(1, "Alice", "player")
        store.join(1, "Bob", "observer")
        store.clear(1)
        assert store.list_participants(1) == []

    def test_clear_nonexistent_exercise_is_noop(self) -> None:
        store = _fresh_store()
        store.clear(999)  # should not raise

    def test_clear_does_not_affect_other_exercises(self) -> None:
        store = _fresh_store()
        store.join(1, "Alice", "player")
        store.join(2, "Bob", "observer")
        store.clear(1)
        assert len(store.list_participants(2)) == 1


# ── Module Singleton ─────────────────────────────────────────────────────


class TestModuleSingleton:
    def test_singleton_is_waiting_room_store(self) -> None:
        assert isinstance(waiting_room_store, WaitingRoomStore)
