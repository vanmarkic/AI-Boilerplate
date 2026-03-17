"""Property-based tests for the collaborative exercise onboarding flow.

These tests target pure functions and in-memory stores — no HTTP, no DB.
This keeps them fast, deterministic, and free from shared-state issues.

Invariants tested:
- Session code format: _generate_session_code() always yields 6 uppercase alphanumeric chars.
- Session code entropy: repeated calls produce distinct values with high probability.
- Participant count: exactly K participants after K joins to the same exercise.
- Name preservation: joined names round-trip through the waiting room store.
- ID uniqueness: every participant receives a distinct UUID.
- Role invariant: all participants joined as 'player' retain that role.
- Isolation: participants from exercise A never appear in exercise B's list.
"""
from __future__ import annotations

from hypothesis import given, settings
from hypothesis import strategies as st

from features.exercise.exercise_model import _generate_session_code
from features.waiting_room.waiting_room_store import WaitingRoomStore


# ── Strategies ────────────────────────────────────────────────────────────────

_player_names = st.text(
    alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd"), whitelist_characters=" -"),
    min_size=1,
    max_size=30,
).filter(lambda s: s.strip())

_exercise_ids = st.integers(min_value=1, max_value=10_000)


# ── Session code properties ───────────────────────────────────────────────────


class TestSessionCodeFormat:
    @given(st.integers(min_value=1, max_value=500))
    @settings(max_examples=200)
    def test_code_is_always_6_uppercase_alphanumeric(self, _: int) -> None:
        code = _generate_session_code()
        assert len(code) == 6, f"Expected 6 chars, got {len(code)!r} in {code!r}"
        assert code.isalnum(), f"Non-alphanumeric chars in {code!r}"
        assert code == code.upper(), f"Code not uppercase: {code!r}"

    @given(st.integers(min_value=2, max_value=20))
    @settings(max_examples=50)
    def test_repeated_calls_produce_distinct_codes(self, n: int) -> None:
        codes = [_generate_session_code() for _ in range(n)]
        # With 36^6 ≈ 2.2B possibilities, duplicates among ≤20 should be vanishingly rare.
        # This property would only fail if the RNG is broken.
        assert len(set(codes)) == len(codes), f"Duplicate codes in {codes}"


# ── WaitingRoomStore properties ───────────────────────────────────────────────


class TestParticipantCountInvariant:
    @given(
        exercise_id=_exercise_ids,
        names=st.lists(_player_names, min_size=1, max_size=10, unique=True),
    )
    @settings(max_examples=100)
    def test_participant_count_equals_join_calls(
        self, exercise_id: int, names: list[str]
    ) -> None:
        store = WaitingRoomStore()
        for name in names:
            store.join(exercise_id, name, "player")
        assert len(store.list_participants(exercise_id)) == len(names)

    @given(
        exercise_id=_exercise_ids,
        names=st.lists(_player_names, min_size=1, max_size=10, unique=True),
    )
    @settings(max_examples=100)
    def test_all_names_preserved_in_store(
        self, exercise_id: int, names: list[str]
    ) -> None:
        store = WaitingRoomStore()
        for name in names:
            store.join(exercise_id, name, "player")
        stored = {p.display_name for p in store.list_participants(exercise_id)}
        assert stored == set(names)

    @given(
        exercise_id=_exercise_ids,
        names=st.lists(_player_names, min_size=1, max_size=10, unique=True),
    )
    @settings(max_examples=100)
    def test_all_participants_retain_player_role(
        self, exercise_id: int, names: list[str]
    ) -> None:
        store = WaitingRoomStore()
        for name in names:
            store.join(exercise_id, name, "player")
        roles = {p.role for p in store.list_participants(exercise_id)}
        assert roles == {"player"}, f"Unexpected roles: {roles}"

    @given(
        exercise_id=_exercise_ids,
        names=st.lists(_player_names, min_size=2, max_size=10, unique=True),
    )
    @settings(max_examples=100)
    def test_participant_ids_are_unique(
        self, exercise_id: int, names: list[str]
    ) -> None:
        store = WaitingRoomStore()
        ids = [store.join(exercise_id, name, "player").id for name in names]
        assert len(ids) == len(set(ids)), f"Duplicate IDs found: {ids}"


class TestExerciseIsolation:
    @given(
        id_a=_exercise_ids,
        id_b=_exercise_ids.filter(lambda x: x != 1),  # ensure they can be distinct
        names_a=st.lists(_player_names, min_size=1, max_size=5, unique=True),
        names_b=st.lists(_player_names, min_size=1, max_size=5, unique=True),
    )
    @settings(max_examples=50)
    def test_participants_never_leak_between_exercises(
        self,
        id_a: int,
        id_b: int,
        names_a: list[str],
        names_b: list[str],
    ) -> None:
        from hypothesis import assume
        assume(id_a != id_b)

        store = WaitingRoomStore()
        for name in names_a:
            store.join(id_a, name, "player")
        for name in names_b:
            store.join(id_b, name, "player")

        a_names = {p.display_name for p in store.list_participants(id_a)}
        b_names = {p.display_name for p in store.list_participants(id_b)}

        assert a_names == set(names_a)
        assert b_names == set(names_b)

    @given(
        id_a=_exercise_ids,
        names=st.lists(_player_names, min_size=1, max_size=5, unique=True),
    )
    @settings(max_examples=50)
    def test_empty_exercise_has_no_participants(
        self, id_a: int, names: list[str]
    ) -> None:
        store = WaitingRoomStore()
        id_b = id_a + 1  # guaranteed different
        for name in names:
            store.join(id_a, name, "player")

        # Exercise B was never joined — must have zero participants
        assert store.list_participants(id_b) == []
