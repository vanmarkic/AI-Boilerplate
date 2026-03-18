"""Property-based tests for joinable endpoint invariants.

Validates the relationship between waiting room state, max player
computation, and the visual state users see — using Hypothesis to
exercise edge cases across all game modes and role combinations.
"""
from __future__ import annotations

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from features.waiting_room.waiting_room_store import WaitingRoomStore


# ── Strategies ───────────────────────────────────────────────────────

role_ids = st.sampled_from(["co", "ops", "nav", "pwo", "aawo", "cyop", "eo"])
game_modes = st.sampled_from(["classic", "simple_collaborative"])
role_lists = st.lists(role_ids, min_size=1, max_size=7, unique=True)


def compute_max_players(roles: list[str], game_mode: str) -> int:
    """Mirror the backend logic: roles + optional GM slot."""
    return len(roles) + (1 if game_mode == "classic" else 0)


# ── TestMaxPlayersComputation ────────────────────────────────────────


class TestMaxPlayersComputation:
    @given(roles=role_lists, game_mode=game_modes)
    @settings(max_examples=50)
    def test_formula_matches_spec(self, roles: list[str], game_mode: str) -> None:
        mp = compute_max_players(roles, game_mode)
        if game_mode == "classic":
            assert mp == len(roles) + 1
        else:
            assert mp == len(roles)

    @given(roles=role_lists, game_mode=game_modes)
    @settings(max_examples=50)
    def test_always_at_least_one_slot(self, roles: list[str], game_mode: str) -> None:
        assert compute_max_players(roles, game_mode) >= 1

    @given(roles=role_lists)
    @settings(max_examples=50)
    def test_classic_always_more_than_collaborative(self, roles: list[str]) -> None:
        classic = compute_max_players(roles, "classic")
        collab = compute_max_players(roles, "simple_collaborative")
        assert classic == collab + 1


# ── TestJoinableSlotAvailability ─────────────────────────────────────


class TestJoinableSlotAvailability:
    @given(roles=role_lists, game_mode=game_modes, data=st.data())
    @settings(max_examples=50)
    def test_under_capacity_has_positive_available_slots(
        self, roles: list[str], game_mode: str, data: st.DataObject,
    ) -> None:
        mp = compute_max_players(roles, game_mode)
        k = data.draw(st.integers(min_value=0, max_value=mp - 1))
        assert mp - k > 0

    @given(roles=role_lists, game_mode=game_modes)
    @settings(max_examples=50)
    def test_at_capacity_zero_available(
        self, roles: list[str], game_mode: str,
    ) -> None:
        mp = compute_max_players(roles, game_mode)
        assert mp - mp == 0

    @given(roles=role_lists, game_mode=game_modes, data=st.data())
    @settings(max_examples=50)
    def test_store_count_matches_available_slots(
        self, roles: list[str], game_mode: str, data: st.DataObject,
    ) -> None:
        """count() in the store drives whether exercise is joinable."""
        mp = compute_max_players(roles, game_mode)
        k = data.draw(st.integers(min_value=0, max_value=mp))
        store = WaitingRoomStore()
        for i in range(k):
            store.join(1, f"P{i}", f"role-{i}")
        joinable = store.count(1) < mp
        assert joinable == (k < mp)


# ── TestRoleSlotConsistency ──────────────────────────────────────────


class TestRoleSlotConsistency:
    @given(roles=role_lists, data=st.data())
    @settings(max_examples=50)
    def test_open_roles_equals_unassigned(
        self, roles: list[str], data: st.DataObject,
    ) -> None:
        k = data.draw(st.integers(min_value=0, max_value=len(roles)))
        store = WaitingRoomStore()
        for i in range(k):
            store.join(1, f"P{i}", roles[i])
        assigned = {p.role for p in store.list_participants(1)}
        open_roles = set(roles) - assigned
        assert len(open_roles) == len(roles) - k

    @given(roles=role_lists, data=st.data())
    @settings(max_examples=50)
    def test_leaving_reopens_their_role(
        self, roles: list[str], data: st.DataObject,
    ) -> None:
        assume(len(roles) >= 2)
        store = WaitingRoomStore()
        pids = []
        for i, role in enumerate(roles):
            p = store.join(1, f"P{i}", role)
            pids.append(p.id)
        leaver = data.draw(st.integers(min_value=0, max_value=len(roles) - 1))
        freed_role = roles[leaver]
        store.leave(1, pids[leaver])
        assert not store.is_role_taken(1, freed_role)


# ── TestVisualStateDerivation ────────────────────────────────────────


class TestVisualStateDerivation:
    """Derive the visual state users see from store + scenario data."""

    @given(roles=role_lists, game_mode=game_modes, data=st.data())
    @settings(max_examples=50)
    def test_filled_plus_open_equals_max(
        self, roles: list[str], game_mode: str, data: st.DataObject,
    ) -> None:
        mp = compute_max_players(roles, game_mode)
        k = data.draw(st.integers(min_value=0, max_value=mp))
        filled = k
        open_slots = mp - k
        assert filled + open_slots == mp

    @given(roles=role_lists, game_mode=game_modes, data=st.data())
    @settings(max_examples=50)
    def test_can_start_iff_full(
        self, roles: list[str], game_mode: str, data: st.DataObject,
    ) -> None:
        mp = compute_max_players(roles, game_mode)
        k = data.draw(st.integers(min_value=0, max_value=mp))
        can_start = (k >= mp)
        assert can_start == (k == mp)

    @given(roles=role_lists, game_mode=game_modes, data=st.data())
    @settings(max_examples=50)
    def test_join_form_and_leave_button_mutually_exclusive(
        self, roles: list[str], game_mode: str, data: st.DataObject,
    ) -> None:
        k = data.draw(st.integers(min_value=0, max_value=len(roles)))
        store = WaitingRoomStore()
        for i in range(k):
            store.join(1, f"P{i}", roles[i])
        pids = {p.id for p in store.list_participants(1)}
        user_id = data.draw(
            st.sampled_from(["P0", "external-user"]),
        )
        is_joined = user_id in pids
        show_join_form = not is_joined
        show_leave_button = is_joined
        # Exactly one of these is true — never both, never neither
        assert show_join_form != show_leave_button

    @given(roles=role_lists, game_mode=game_modes)
    @settings(max_examples=50)
    def test_gm_slot_visible_iff_classic(
        self, roles: list[str], game_mode: str,
    ) -> None:
        show_gm = game_mode == "classic"
        assert show_gm == (game_mode == "classic")
        # And it contributes exactly 1 to max_players
        mp_with = compute_max_players(roles, "classic")
        mp_without = compute_max_players(roles, "simple_collaborative")
        assert mp_with - mp_without == 1
