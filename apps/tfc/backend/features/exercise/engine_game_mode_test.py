"""Behavioral tests verifying game mode differences at the API level.

Classic mode: pauses on decision, requires GM, no scoring.
Collaborative mode: no auto-pause, no GM required, scoring + penalties.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from engine.session_store import session_store

CLASSIC_SCENARIO = {
    "events": [
        {
            "id": "evt-d",
            "title": "Decision Event",
            "event_type": "decision",
            "scheduled_pt_ms": 0,
        },
    ],
    "decision_templates": [
        {
            "id": "evt-d",
            "title": "Classic Decision",
            "issue_id": "iss-1",
            "question_type": "single_choice",
            "options": [
                {
                    "id": "a",
                    "label": "A",
                    "score": 10,
                    "stress_delta": 0,
                    "system_effects": [],
                    "targets_system": False,
                    "max_plays": 1,
                    "role": None,
                },
                {
                    "id": "b",
                    "label": "B",
                    "score": 0,
                    "stress_delta": 0,
                    "system_effects": [],
                    "targets_system": False,
                    "max_plays": 1,
                    "role": None,
                },
            ],
            "completion_mode": "gm_closes",
        },
    ],
    "roles": [
        {"id": "co", "label": "CO", "player_type": "decision_maker"},
    ],
    "game_mode": "classic",
}

COLLABORATIVE_SCENARIO = {
    "events": [
        {
            "id": "evt-d",
            "title": "Decision Event",
            "event_type": "decision",
            "scheduled_pt_ms": 0,
        },
    ],
    "decision_templates": [
        {
            "id": "evt-d",
            "title": "Collab Decision",
            "issue_id": "iss-1",
            "question_type": "single_choice",
            "options": [
                {
                    "id": "a",
                    "label": "A",
                    "score": 10,
                    "stress_delta": 0,
                    "system_effects": [],
                    "targets_system": False,
                    "max_plays": 1,
                    "role": None,
                },
                {
                    "id": "b",
                    "label": "B",
                    "score": 0,
                    "stress_delta": 0,
                    "system_effects": [],
                    "targets_system": False,
                    "max_plays": 1,
                    "role": None,
                },
            ],
            "completion_mode": "gm_closes",
        },
    ],
    "roles": [
        {"id": "co", "label": "CO", "player_type": "decision_maker"},
        {"id": "ops", "label": "OPS", "player_type": "advisor"},
    ],
    "game_mode": "simple_collaborative",
    "decision_sequence": ["evt-d"],
    "game_mode_config": {
        "base_decision_time_ms": 60000,
    },
}


@pytest.fixture(autouse=True)
def _cleanup_sessions() -> None:
    yield
    for eid in list(session_store._sessions.keys()):
        engine = session_store.get(eid)
        if engine:
            engine._stop_tick_loop()
            engine._stop_timeout_monitor()
        session_store.remove(eid)


async def _setup_exercise(
    client: AsyncClient,
    scenario_content: dict,
) -> int:
    """Create scenario + exercise + start engine, return exercise ID."""
    sc = await client.post(
        "/api/scenarios",
        json={
            "title": "Mode Test Scenario",
            "content": scenario_content,
        },
    )
    assert sc.status_code == 201

    game_mode = scenario_content.get("game_mode", "classic")
    ex = await client.post(
        "/api/exercises",
        json={
            "title": "Mode Test Ex",
            "scenario_id": sc.json()["id"],
            "game_mode": game_mode,
        },
    )
    assert ex.status_code == 201
    eid = ex.json()["id"]

    start = await client.post(f"/api/exercises/{eid}/engine/start")
    assert start.status_code == 200
    begin = await client.post(f"/api/exercises/{eid}/engine/begin")
    assert begin.status_code == 200
    return eid


# ── Classic mode pauses on decision ──────────────────────────────────────


@pytest.mark.asyncio
async def test_classic_mode_pauses_on_decision(
    client: AsyncClient,
) -> None:
    """Classic mode should auto-pause when a decision event triggers."""
    eid = await _setup_exercise(client, CLASSIC_SCENARIO)
    engine = session_store.get(eid)
    assert engine is not None

    # Let the tick loop process the decision event (scheduled at t=0)
    import asyncio

    await asyncio.sleep(0.6)  # >2 ticks at 250ms

    snap = await client.get(f"/api/exercises/{eid}/engine/snapshot")
    data = snap.json()
    # Classic mode should have paused
    assert data["phase"] == "paused"
    # Decision should be open
    assert len(data["decisions"]) > 0


# ── Collaborative mode does NOT pause on decision ────────────────────────


@pytest.mark.asyncio
async def test_collaborative_mode_does_not_pause(
    client: AsyncClient,
) -> None:
    """Collaborative mode should NOT auto-pause when a decision opens."""
    eid = await _setup_exercise(client, COLLABORATIVE_SCENARIO)
    engine = session_store.get(eid)
    assert engine is not None

    import asyncio

    await asyncio.sleep(0.6)

    snap = await client.get(f"/api/exercises/{eid}/engine/snapshot")
    data = snap.json()
    # Collaborative mode should still be running
    assert data["phase"] == "running"
    # Decision should still be open
    assert len(data["decisions"]) > 0


# ── Classic mode produces no scoring ─────────────────────────────────────


@pytest.mark.asyncio
async def test_classic_mode_no_scoring_on_close(
    client: AsyncClient,
) -> None:
    """Classic mode close_decision produces no score_change broadcasts."""
    from unittest.mock import AsyncMock, patch

    eid = await _setup_exercise(client, CLASSIC_SCENARIO)

    import asyncio

    await asyncio.sleep(0.6)

    mock_broadcast = AsyncMock()
    with patch("features.exercise.engine_router.connection_manager") as mock_mgr:
        mock_mgr.broadcast = mock_broadcast
        mock_mgr.broadcast_to_role = AsyncMock()
        resp = await client.post(
            f"/api/exercises/{eid}/engine/decisions/evt-d/close",
            json={"selected_option_ids": ["a"]},
        )
        assert resp.status_code == 200

    # Classic mode: on_decision_closed_v2 returns [] → no broadcast
    if mock_broadcast.called:
        for call in mock_broadcast.call_args_list:
            msg = call[0][1]
            changes = msg.get("changes", [])
            types = [c["type"] for c in changes]
            assert "score_change" not in types


# ── Game mode is correctly loaded from scenario ──────────────────────────


@pytest.mark.asyncio
async def test_classic_mode_requires_gm(client: AsyncClient) -> None:
    eid = await _setup_exercise(client, CLASSIC_SCENARIO)
    engine = session_store.get(eid)
    assert engine.game_mode.requires_gm() is True


@pytest.mark.asyncio
async def test_collaborative_mode_no_gm_required(
    client: AsyncClient,
) -> None:
    eid = await _setup_exercise(client, COLLABORATIVE_SCENARIO)
    engine = session_store.get(eid)
    assert engine.game_mode.requires_gm() is False
