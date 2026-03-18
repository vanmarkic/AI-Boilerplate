"""TDD tests for GET /api/exercises/joinable endpoint.

Returns the single joinable exercise (phase=setup, has waiting room with
available slots and a linked scenario with roles), or 404.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from features.waiting_room.waiting_room_store import waiting_room_store


@pytest.fixture(autouse=True)
def _reset_waiting_room() -> None:
    waiting_room_store._rooms.clear()


async def _create_scenario_with_roles(
    client: AsyncClient, roles: list[dict],
    game_mode: str = "simple_collaborative",
) -> int:
    resp = await client.post(
        "/api/scenarios",
        json={
            "title": "Joinable Scenario",
            "content": {
                "phases": [], "events": [], "issues": [],
                "decision_templates": [],
                "default_time_factor": 1.0,
                "briefing": "Test", "objectives": [], "rules": [],
                "game_mode": game_mode,
                "game_mode_config": {},
                "decision_sequence": [],
                "roles": roles,
            },
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_exercise(
    client: AsyncClient,
    scenario_id: int | None = None,
    game_mode: str = "classic",
) -> int:
    resp = await client.post(
        "/api/exercises",
        json={
            "title": "Test Exercise",
            "scenario_id": scenario_id,
            "game_mode": game_mode,
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _join(
    client: AsyncClient, exercise_id: int,
    name: str = "Alice", role: str = "player",
) -> dict:
    resp = await client.post(
        f"/api/exercises/{exercise_id}/waiting-room/join",
        json={"display_name": name, "role": role},
    )
    assert resp.status_code == 200
    return resp.json()


TWO_ROLES = [
    {"id": "co", "label": "CO", "player_type": "decision_maker"},
    {"id": "nav", "label": "NAV", "player_type": "advisor"},
]


class TestJoinableEndpoint:
    @pytest.mark.asyncio
    async def test_returns_404_when_no_setup_exercises(
        self, client: AsyncClient,
    ) -> None:
        resp = await client.get("/api/exercises/joinable")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_returns_exercise_with_available_slots(
        self, client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(client, TWO_ROLES)
        eid = await _create_exercise(client, sid, "simple_collaborative")
        await _join(client, eid, "Alice", "co")

        resp = await client.get("/api/exercises/joinable")
        assert resp.status_code == 200
        data = resp.json()
        assert data["exercise"]["id"] == eid
        assert len(data["participants"]) == 1
        assert data["max_players"] == 2

    @pytest.mark.asyncio
    async def test_returns_404_when_all_slots_filled(
        self, client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(client, TWO_ROLES)
        eid = await _create_exercise(client, sid, "simple_collaborative")
        await _join(client, eid, "Alice", "co")
        await _join(client, eid, "Bob", "nav")

        resp = await client.get("/api/exercises/joinable")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_includes_roles_and_participants(
        self, client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(client, TWO_ROLES)
        eid = await _create_exercise(client, sid, "simple_collaborative")

        resp = await client.get("/api/exercises/joinable")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["roles"]) == 2
        role_ids = {r["id"] for r in data["roles"]}
        assert role_ids == {"co", "nav"}
        assert data["participants"] == []
        assert data["requires_gm"] is False

    @pytest.mark.asyncio
    async def test_ignores_running_exercises(
        self, client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(client, TWO_ROLES)
        eid = await _create_exercise(client, sid, "simple_collaborative")
        # Move exercise to running phase
        await client.put(
            f"/api/exercises/{eid}",
            json={"phase": "running"},
        )

        resp = await client.get("/api/exercises/joinable")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_ignores_exercises_without_scenario(
        self, client: AsyncClient,
    ) -> None:
        await _create_exercise(client)  # no scenario

        resp = await client.get("/api/exercises/joinable")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_classic_mode_includes_gm_slot(
        self, client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(
            client, TWO_ROLES, game_mode="classic",
        )
        eid = await _create_exercise(client, sid, "classic")

        resp = await client.get("/api/exercises/joinable")
        assert resp.status_code == 200
        data = resp.json()
        assert data["requires_gm"] is True
        assert data["max_players"] == 3  # 2 roles + 1 GM
