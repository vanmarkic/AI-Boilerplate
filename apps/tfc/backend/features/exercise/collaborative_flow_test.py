"""Integration tests for the collaborative exercise onboarding flow.

Covers end-to-end: exercise creation → session code lookup → player join
→ waiting room list → engine start. No GM required at any step.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from engine.session_store import session_store
from features.waiting_room.waiting_room_store import waiting_room_store


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    for eid in list(session_store._sessions.keys()):
        engine = session_store.get(eid)
        if engine:
            engine._stop_tick_loop()
            engine._stop_timeout_monitor()
        session_store.remove(eid)
    waiting_room_store._rooms.clear()


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _create_collab(client: AsyncClient, title: str = "Silent Wake") -> dict:
    resp = await client.post(
        "/api/exercises",
        json={"title": title, "game_mode": "simple_collaborative"},
    )
    assert resp.status_code == 201
    return resp.json()


async def _join(client: AsyncClient, exercise_id: int, name: str) -> dict:
    resp = await client.post(
        f"/api/exercises/{exercise_id}/waiting-room/join",
        json={"display_name": name, "role": "player"},
    )
    assert resp.status_code == 200
    return resp.json()


# ── Exercise creation ─────────────────────────────────────────────────────────


class TestCollaborativeExerciseCreation:
    @pytest.mark.asyncio
    async def test_created_exercise_has_correct_game_mode(self, client: AsyncClient) -> None:
        ex = await _create_collab(client)
        assert ex["game_mode"] == "simple_collaborative"

    @pytest.mark.asyncio
    async def test_created_exercise_has_session_code(self, client: AsyncClient) -> None:
        ex = await _create_collab(client)
        assert ex["session_code"]
        assert len(ex["session_code"]) == 6

    @pytest.mark.asyncio
    async def test_session_code_is_uppercase_alphanumeric(self, client: AsyncClient) -> None:
        ex = await _create_collab(client)
        code = ex["session_code"]
        assert code.isalnum()
        assert code == code.upper()

    @pytest.mark.asyncio
    async def test_two_exercises_have_distinct_session_codes(self, client: AsyncClient) -> None:
        ex1 = await _create_collab(client, "Collab A")
        ex2 = await _create_collab(client, "Collab B")
        assert ex1["session_code"] != ex2["session_code"]

    @pytest.mark.asyncio
    async def test_invalid_game_mode_rejected(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/exercises",
            json={"title": "Bad Mode", "game_mode": "unknown_mode"},
        )
        assert resp.status_code == 400


# ── Session code lookup ───────────────────────────────────────────────────────


class TestSessionCodeLookup:
    @pytest.mark.asyncio
    async def test_lookup_returns_exercise_with_game_mode(self, client: AsyncClient) -> None:
        ex = await _create_collab(client)
        resp = await client.get(f"/api/exercises/by-code/{ex['session_code']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == ex["id"]
        assert data["game_mode"] == "simple_collaborative"
        assert data["session_code"] == ex["session_code"]

    @pytest.mark.asyncio
    async def test_lookup_is_case_insensitive(self, client: AsyncClient) -> None:
        ex = await _create_collab(client)
        lowercase_code = ex["session_code"].lower()
        resp = await client.get(f"/api/exercises/by-code/{lowercase_code}")
        assert resp.status_code == 200
        assert resp.json()["id"] == ex["id"]

    @pytest.mark.asyncio
    async def test_unknown_code_returns_404(self, client: AsyncClient) -> None:
        resp = await client.get("/api/exercises/by-code/ZZZZZZ")
        assert resp.status_code == 404


# ── Player joining ────────────────────────────────────────────────────────────


class TestCollaborativePlayerJoin:
    @pytest.mark.asyncio
    async def test_player_joins_with_correct_name_and_role(self, client: AsyncClient) -> None:
        ex = await _create_collab(client)
        participant = await _join(client, ex["id"], "Alice")
        assert participant["display_name"] == "Alice"
        assert participant["role"] == "player"

    @pytest.mark.asyncio
    async def test_player_receives_unique_id_on_join(self, client: AsyncClient) -> None:
        ex = await _create_collab(client)
        p1 = await _join(client, ex["id"], "Alice")
        p2 = await _join(client, ex["id"], "Bob")
        assert p1["id"] != p2["id"]

    @pytest.mark.asyncio
    async def test_multiple_players_all_appear_in_waiting_room(self, client: AsyncClient) -> None:
        ex = await _create_collab(client)
        eid = ex["id"]
        names = ["Alice", "Bob", "Charlie"]
        for name in names:
            await _join(client, eid, name)

        resp = await client.get(f"/api/exercises/{eid}/waiting-room")
        assert resp.status_code == 200
        listed_names = {p["display_name"] for p in resp.json()["participants"]}
        assert listed_names == set(names)

    @pytest.mark.asyncio
    async def test_all_participants_have_player_role(self, client: AsyncClient) -> None:
        ex = await _create_collab(client)
        eid = ex["id"]
        for name in ["Alice", "Bob", "Charlie"]:
            await _join(client, eid, name)

        participants = (await client.get(f"/api/exercises/{eid}/waiting-room")).json()["participants"]
        roles = {p["role"] for p in participants}
        assert roles == {"player"}


# ── Engine start ──────────────────────────────────────────────────────────────


class TestCollaborativeEngineStart:
    @pytest.mark.asyncio
    async def test_exercise_starts_without_gm(self, client: AsyncClient) -> None:
        ex = await _create_collab(client)
        eid = ex["id"]
        await _join(client, eid, "Alice")

        resp = await client.post(f"/api/exercises/{eid}/engine/start")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_start_is_idempotent(self, client: AsyncClient) -> None:
        ex = await _create_collab(client)
        eid = ex["id"]
        await _join(client, eid, "Alice")

        first = await client.post(f"/api/exercises/{eid}/engine/start")
        second = await client.post(f"/api/exercises/{eid}/engine/start")
        assert first.status_code == 200
        assert second.status_code == 200

    @pytest.mark.asyncio
    async def test_starting_nonexistent_exercise_returns_404(self, client: AsyncClient) -> None:
        resp = await client.post("/api/exercises/99999/engine/start")
        assert resp.status_code == 404


# ── Full onboarding flow ──────────────────────────────────────────────────────


class TestCollaborativeFullFlow:
    @pytest.mark.asyncio
    async def test_complete_player_onboarding(self, client: AsyncClient) -> None:
        # 1. Create collaborative exercise
        ex = await _create_collab(client, "Silent Wake")
        assert ex["game_mode"] == "simple_collaborative"
        code = ex["session_code"]
        eid = ex["id"]

        # 2. Players discover exercise via session code
        lookup = await client.get(f"/api/exercises/by-code/{code}")
        assert lookup.status_code == 200
        assert lookup.json()["game_mode"] == "simple_collaborative"

        # 3. Multiple players join
        for name in ["Alice", "Bob", "Charlie"]:
            await _join(client, eid, name)

        # 4. Waiting room reflects all players with correct roles
        participants = (await client.get(f"/api/exercises/{eid}/waiting-room")).json()["participants"]
        assert len(participants) == 3
        assert all(p["role"] == "player" for p in participants)

        # 5. Any player can start — no GM required
        start_resp = await client.post(f"/api/exercises/{eid}/engine/start")
        assert start_resp.status_code == 200

    @pytest.mark.asyncio
    async def test_exercises_are_isolated(self, client: AsyncClient) -> None:
        """Players joining exercise A must not appear in exercise B."""
        ex_a = await _create_collab(client, "Exercise A")
        ex_b = await _create_collab(client, "Exercise B")

        await _join(client, ex_a["id"], "Alice")
        await _join(client, ex_b["id"], "Bob")

        a_names = {p["display_name"] for p in
                   (await client.get(f"/api/exercises/{ex_a['id']}/waiting-room")).json()["participants"]}
        b_names = {p["display_name"] for p in
                   (await client.get(f"/api/exercises/{ex_b['id']}/waiting-room")).json()["participants"]}

        assert a_names == {"Alice"}
        assert b_names == {"Bob"}
