"""Tests for practice_mode flag on exercises."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from features.waiting_room.waiting_room_store import waiting_room_store


@pytest.fixture(autouse=True)
def _reset_waiting_room() -> None:
    waiting_room_store._rooms.clear()


async def _create_scenario(client: AsyncClient) -> int:
    resp = await client.post(
        "/api/scenarios",
        json={
            "title": "Practice Scenario",
            "content": {
                "phases": [],
                "events": [],
                "issues": [],
                "decision_templates": [],
                "default_time_factor": 1.0,
                "briefing": "Test",
                "objectives": [],
                "rules": [],
                "game_mode": "simple_collaborative",
                "game_mode_config": {},
                "decision_sequence": [],
                "roles": [
                    {"id": "co", "label": "CO", "player_type": "decision_maker"},
                    {"id": "nav", "label": "NAV", "player_type": "advisor"},
                ],
            },
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


class TestPracticeModeCreation:
    @pytest.mark.asyncio
    async def test_create_exercise_with_practice_mode(
        self,
        client: AsyncClient,
    ) -> None:
        resp = await client.post(
            "/api/exercises",
            json={
                "title": "Solo Practice",
                "game_mode": "simple_collaborative",
                "practice_mode": True,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["practice_mode"] is True

    @pytest.mark.asyncio
    async def test_create_exercise_defaults_practice_mode_false(
        self,
        client: AsyncClient,
    ) -> None:
        resp = await client.post(
            "/api/exercises",
            json={"title": "Normal", "game_mode": "simple_collaborative"},
        )
        assert resp.status_code == 201
        assert resp.json()["practice_mode"] is False

    @pytest.mark.asyncio
    async def test_practice_mode_requires_simple_collaborative(
        self,
        client: AsyncClient,
    ) -> None:
        resp = await client.post(
            "/api/exercises",
            json={
                "title": "Bad",
                "game_mode": "classic",
                "practice_mode": True,
            },
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_get_exercise_returns_practice_mode(
        self,
        client: AsyncClient,
    ) -> None:
        create_resp = await client.post(
            "/api/exercises",
            json={
                "title": "Solo",
                "game_mode": "simple_collaborative",
                "practice_mode": True,
            },
        )
        eid = create_resp.json()["id"]
        resp = await client.get(f"/api/exercises/{eid}")
        assert resp.status_code == 200
        assert resp.json()["practice_mode"] is True


class TestPracticeModeUpdateValidation:
    @pytest.mark.asyncio
    async def test_update_game_mode_away_from_collaborative_rejected(
        self,
        client: AsyncClient,
    ) -> None:
        resp = await client.post(
            "/api/exercises",
            json={
                "title": "Solo",
                "game_mode": "simple_collaborative",
                "practice_mode": True,
            },
        )
        eid = resp.json()["id"]
        resp = await client.put(
            f"/api/exercises/{eid}",
            json={"game_mode": "classic"},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_update_practice_mode_on_classic_rejected(
        self,
        client: AsyncClient,
    ) -> None:
        resp = await client.post(
            "/api/exercises",
            json={"title": "Classic", "game_mode": "classic"},
        )
        eid = resp.json()["id"]
        resp = await client.put(
            f"/api/exercises/{eid}",
            json={"practice_mode": True},
        )
        assert resp.status_code == 400


class TestPracticeModeWaitingRoom:
    @pytest.mark.asyncio
    async def test_practice_mode_allows_single_player(
        self,
        client: AsyncClient,
    ) -> None:
        sid = await _create_scenario(client)
        resp = await client.post(
            "/api/exercises",
            json={
                "title": "Solo",
                "scenario_id": sid,
                "game_mode": "simple_collaborative",
                "practice_mode": True,
            },
        )
        eid = resp.json()["id"]

        join_resp = await client.post(
            f"/api/exercises/{eid}/waiting-room/join",
            json={"display_name": "Solo Player", "role": "solo_player"},
        )
        assert join_resp.status_code == 200

    @pytest.mark.asyncio
    async def test_practice_mode_rejects_second_player(
        self,
        client: AsyncClient,
    ) -> None:
        sid = await _create_scenario(client)
        resp = await client.post(
            "/api/exercises",
            json={
                "title": "Solo",
                "scenario_id": sid,
                "game_mode": "simple_collaborative",
                "practice_mode": True,
            },
        )
        eid = resp.json()["id"]

        await client.post(
            f"/api/exercises/{eid}/waiting-room/join",
            json={"display_name": "Player 1", "role": "solo_player"},
        )
        resp2 = await client.post(
            f"/api/exercises/{eid}/waiting-room/join",
            json={"display_name": "Player 2", "role": "other"},
        )
        assert resp2.status_code == 409


class TestPracticeModeTimer:
    def test_practice_mode_applies_timer_multiplier(self) -> None:
        from features.scenario.scenario_content import ScenarioContent
        from features.scenario.scenario_loader import build_engine_config

        content = ScenarioContent.model_validate(
            {
                "phases": [],
                "events": [],
                "issues": [],
                "decision_templates": [],
                "default_time_factor": 1.0,
                "briefing": "Test",
                "objectives": [],
                "rules": [],
                "game_mode": "simple_collaborative",
                "game_mode_config": {"base_decision_time_ms": 300_000},
                "decision_sequence": [],
                "roles": [
                    {"id": "co", "label": "CO", "player_type": "decision_maker"},
                    {"id": "nav", "label": "NAV", "player_type": "advisor"},
                ],
            }
        )
        config = build_engine_config(1, "Test", content, practice_mode=True)
        assert config.game_mode.base_decision_time_ms == 450_000

    def test_normal_mode_keeps_base_timer(self) -> None:
        from features.scenario.scenario_content import ScenarioContent
        from features.scenario.scenario_loader import build_engine_config

        content = ScenarioContent.model_validate(
            {
                "phases": [],
                "events": [],
                "issues": [],
                "decision_templates": [],
                "default_time_factor": 1.0,
                "briefing": "Test",
                "objectives": [],
                "rules": [],
                "game_mode": "simple_collaborative",
                "game_mode_config": {"base_decision_time_ms": 300_000},
                "decision_sequence": [],
                "roles": [
                    {"id": "co", "label": "CO", "player_type": "decision_maker"},
                    {"id": "nav", "label": "NAV", "player_type": "advisor"},
                ],
            }
        )
        config = build_engine_config(1, "Test", content, practice_mode=False)
        assert config.game_mode.base_decision_time_ms == 300_000
