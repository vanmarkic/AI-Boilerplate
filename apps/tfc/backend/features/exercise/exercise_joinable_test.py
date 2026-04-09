"""TDD tests for GET /api/exercises/joinable endpoint.

Returns all joinable exercises (phase=setup, has waiting room with
available slots and a linked scenario with roles) as a list.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from features.waiting_room.waiting_room_store import waiting_room_store


@pytest.fixture(autouse=True)
def _reset_waiting_room() -> None:
    waiting_room_store._rooms.clear()


async def _create_scenario_with_roles(
    client: AsyncClient,
    roles: list[dict],
    game_mode: str = "simple_collaborative",
) -> int:
    resp = await client.post(
        "/api/scenarios",
        json={
            "title": "Joinable Scenario",
            "content": {
                "phases": [],
                "events": [],
                "issues": [],
                "decision_templates": [],
                "default_time_factor": 1.0,
                "briefing": "Test",
                "objectives": [],
                "rules": [],
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
    title: str = "Test Exercise",
) -> int:
    resp = await client.post(
        "/api/exercises",
        json={
            "title": title,
            "scenario_id": scenario_id,
            "game_mode": game_mode,
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _join(
    client: AsyncClient,
    exercise_id: int,
    name: str = "Alice",
    role: str = "player",
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

ADVISOR_ONLY_ROLES = [
    {"id": "nav", "label": "NAV", "player_type": "advisor"},
]


class TestJoinableEndpoint:
    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_setup_exercises(
        self,
        client: AsyncClient,
    ) -> None:
        resp = await client.get("/api/exercises/joinable")
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_returns_exercise_with_available_slots(
        self,
        client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(client, TWO_ROLES)
        eid = await _create_exercise(client, sid, "simple_collaborative")
        await _join(client, eid, "Alice", "co")

        resp = await client.get("/api/exercises/joinable")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["exercise"]["id"] == eid
        assert len(data[0]["participants"]) == 1
        assert data[0]["max_players"] == 2

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_all_slots_filled(
        self,
        client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(client, TWO_ROLES)
        eid = await _create_exercise(client, sid, "simple_collaborative")
        await _join(client, eid, "Alice", "co")
        await _join(client, eid, "Bob", "nav")

        resp = await client.get("/api/exercises/joinable")
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_includes_roles_and_participants(
        self,
        client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(client, TWO_ROLES)
        _eid = await _create_exercise(client, sid, "simple_collaborative")

        resp = await client.get("/api/exercises/joinable")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert len(data[0]["roles"]) == 2
        role_ids = {r["id"] for r in data[0]["roles"]}
        assert role_ids == {"co", "nav"}
        assert data[0]["participants"] == []
        assert data[0]["requires_trainer"] is False

    @pytest.mark.asyncio
    async def test_ignores_running_exercises(
        self,
        client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(client, TWO_ROLES)
        eid = await _create_exercise(client, sid, "simple_collaborative")
        # Move exercise through briefing → running
        await client.put(
            f"/api/exercises/{eid}",
            json={"phase": "briefing"},
        )
        await client.put(
            f"/api/exercises/{eid}",
            json={"phase": "running"},
        )

        resp = await client.get("/api/exercises/joinable")
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_ignores_exercises_without_scenario(
        self,
        client: AsyncClient,
    ) -> None:
        await _create_exercise(client)  # no scenario

        resp = await client.get("/api/exercises/joinable")
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_classic_mode_includes_gm_slot(
        self,
        client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(
            client,
            TWO_ROLES,
            game_mode="classic",
        )
        _eid = await _create_exercise(client, sid, "classic")

        resp = await client.get("/api/exercises/joinable")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["requires_trainer"] is True
        assert data[0]["max_players"] == 3  # 2 roles + 1 GM

    @pytest.mark.asyncio
    async def test_excludes_practice_mode_exercises(
        self,
        client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(client, TWO_ROLES)
        resp = await client.post(
            "/api/exercises",
            json={
                "title": "Practice",
                "scenario_id": sid,
                "game_mode": "simple_collaborative",
                "practice_mode": True,
            },
        )
        assert resp.status_code == 201

        resp = await client.get("/api/exercises/joinable")
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_returns_multiple_joinable_exercises(
        self,
        client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(client, TWO_ROLES)
        eid1 = await _create_exercise(
            client,
            sid,
            "simple_collaborative",
            title="Exercise A",
        )
        eid2 = await _create_exercise(
            client,
            sid,
            "simple_collaborative",
            title="Exercise B",
        )

        resp = await client.get("/api/exercises/joinable")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        returned_ids = {d["exercise"]["id"] for d in data}
        assert returned_ids == {eid1, eid2}


class TestScenarioContentValidationResilience:
    """Regression: uncaught ValidationError in joinable endpoint.

    When ScenarioContent.model_validate() raises (e.g. stale seed data
    missing a decision_maker role), the endpoint must skip the bad
    scenario instead of returning 500.
    """

    def test_model_validate_rejects_advisor_only_roles(self) -> None:
        """Confirm the validator catches the exact condition that caused
        the production 500."""
        from pydantic import ValidationError

        from features.scenario.scenario_content import ScenarioContent

        bad_content = {
            "phases": [],
            "events": [],
            "issues": [],
            "decision_templates": [],
            "default_time_factor": 1.0,
            "game_mode": "simple_collaborative",
            "roles": [{"id": "x", "label": "X", "player_type": "advisor"}],
        }
        with pytest.raises(ValidationError, match="decision_maker"):
            ScenarioContent.model_validate(bad_content)
