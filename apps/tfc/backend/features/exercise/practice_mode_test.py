"""Tests for practice_mode flag on exercises."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


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
