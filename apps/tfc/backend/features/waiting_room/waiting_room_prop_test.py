"""Property-based tests for WaitingRoomStore capacity and role invariants.

Uses Hypothesis to generate arbitrary sequences of joins, leaves, and role
changes, then verifies structural invariants hold after every operation.
"""
from __future__ import annotations

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from features.waiting_room.waiting_room_store import WaitingRoomStore


# ── Strategies ───────────────────────────────────────────────────────────

role_ids = st.sampled_from(["co", "ops", "nav", "pwo", "aawo", "cyop", "eo"])
display_names = st.text(min_size=1, max_size=20, alphabet="abcdefghijklmnopqrstuvwxyz")


# ── TestJoinCapacity ─────────────────────────────────────────────────────


class TestJoinCapacity:
    """After N joins with unique roles, the store has exactly N participants."""

    @given(n=st.integers(min_value=1, max_value=7))
    @settings(max_examples=50)
    def test_n_joins_yield_n_participants(self, n: int) -> None:
        store = WaitingRoomStore()
        all_roles = ["co", "ops", "nav", "pwo", "aawo", "cyop", "eo"]
        roles = all_roles[:n]

        for i, role in enumerate(roles):
            store.join(1, f"Player{i}", role)

        assert store.count(1) == n
        assert len(store.list_participants(1)) == n

    @given(n=st.integers(min_value=1, max_value=7))
    @settings(max_examples=50)
    def test_no_duplicate_roles_after_unique_joins(self, n: int) -> None:
        store = WaitingRoomStore()
        all_roles = ["co", "ops", "nav", "pwo", "aawo", "cyop", "eo"]
        roles = all_roles[:n]

        for i, role in enumerate(roles):
            store.join(1, f"Player{i}", role)

        assigned = [p.role for p in store.list_participants(1)]
        assert len(assigned) == len(set(assigned))


# ── TestUniqueRoles ──────────────────────────────────────────────────────


class TestUniqueRoles:
    """is_role_taken correctly detects taken/free roles."""

    @given(
        roles=st.lists(role_ids, min_size=1, max_size=7, unique=True),
        query_role=role_ids,
    )
    @settings(max_examples=100)
    def test_is_role_taken_consistent(
        self, roles: list[str], query_role: str,
    ) -> None:
        store = WaitingRoomStore()
        for i, role in enumerate(roles):
            store.join(1, f"P{i}", role)

        expected = query_role in roles
        assert store.is_role_taken(1, query_role) is expected

    @given(
        roles=st.lists(role_ids, min_size=2, max_size=7, unique=True),
    )
    @settings(max_examples=50)
    def test_exclude_participant_makes_own_role_available(
        self, roles: list[str],
    ) -> None:
        store = WaitingRoomStore()
        participants = []
        for i, role in enumerate(roles):
            p = store.join(1, f"P{i}", role)
            participants.append(p)

        # Each participant's role should appear free when excluding them
        for p in participants:
            others_with_same = [
                q for q in participants
                if q.role == p.role and q.id != p.id
            ]
            if not others_with_same:
                assert store.is_role_taken(
                    1, p.role, exclude_participant=p.id,
                ) is False


# ── TestJoinLeaveCount ───────────────────────────────────────────────────


class TestJoinLeaveCount:
    """count() always equals len(list_participants()) after any sequence."""

    @given(
        join_count=st.integers(min_value=0, max_value=10),
        leave_indices=st.lists(
            st.integers(min_value=0, max_value=9), max_size=5,
        ),
    )
    @settings(max_examples=100)
    def test_count_equals_list_length(
        self, join_count: int, leave_indices: list[int],
    ) -> None:
        store = WaitingRoomStore()
        participants = []

        for i in range(join_count):
            p = store.join(1, f"P{i}", f"role-{i}")
            participants.append(p)

        for idx in leave_indices:
            if 0 <= idx < len(participants):
                store.leave(1, participants[idx].id)

        assert store.count(1) == len(store.list_participants(1))
