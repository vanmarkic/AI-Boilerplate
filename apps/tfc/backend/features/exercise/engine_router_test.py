"""HTTP API tests for engine lifecycle endpoints (start, pause, resume, etc.)."""
from __future__ import annotations

import pytest
from httpx import AsyncClient
from unittest.mock import patch

from engine.engine_config import EngineConfig, ScenarioContext
from engine.event_scheduler import EventType, ScheduledEvent
from engine.session_store import session_store


def _config(exercise_id: int = 1) -> EngineConfig:
    return EngineConfig(
        exercise_id=exercise_id,
        title="Test",
        context=ScenarioContext(
            title="Ctx", description="Desc",
            briefing="Brief", objectives=["obj1"], rules=["rule1"],
        ),
        events=[
            ScheduledEvent(
                id="e1", title="E1", description="",
                event_type=EventType.OPERATIONAL,
                scheduled_pt_ms=0.0, duration_ms=99999.0,
            ),
        ],
    )


@pytest.fixture(autouse=True)
def _cleanup_sessions():
    yield
    for eid in list(session_store._sessions.keys()):
        engine = session_store.get(eid)
        if engine:
            engine._stop_tick_loop()
            engine._stop_timeout_monitor()
        session_store.remove(eid)


def _create_engine(exercise_id: int) -> None:
    """Create and start an engine in the session store."""
    config = _config(exercise_id)
    engine = session_store.create(config)
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
    engine._phase = engine._phase.__class__("running")


async def _create_exercise(client: AsyncClient) -> int:
    resp = await client.post("/api/exercises", json={"title": "Engine Test Ex"})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_exercise_with_scenario(client: AsyncClient) -> int:
    sc = await client.post("/api/scenarios", json={
        "title": "Engine Scenario",
        "content": {
            "game_mode": "classic",
            "roles": [
                {"id": "co", "label": "CO", "player_type": "decision_maker"},
            ],
        },
    })
    assert sc.status_code == 201
    resp = await client.post("/api/exercises", json={
        "title": "Engine Test Ex",
        "scenario_id": sc.json()["id"],
    })
    assert resp.status_code == 201
    return resp.json()["id"]


# ── Start ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_start_engine(client: AsyncClient) -> None:
    eid = await _create_exercise_with_scenario(client)
    resp = await client.post(f"/api/exercises/{eid}/engine/start")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_start_engine_no_exercise_404(client: AsyncClient) -> None:
    resp = await client.post("/api/exercises/99999/engine/start")
    assert resp.status_code == 404


# ── Pause / Resume ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pause_engine(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid)
    resp = await client.post(f"/api/exercises/{eid}/engine/pause")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_pause_engine_no_engine_404(client: AsyncClient) -> None:
    resp = await client.post("/api/exercises/99999/engine/pause")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_resume_engine(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid)
    await client.post(f"/api/exercises/{eid}/engine/pause")
    resp = await client.post(f"/api/exercises/{eid}/engine/resume")
    assert resp.status_code == 200


# ── Reset / Complete ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_reset_engine(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid)
    resp = await client.post(f"/api/exercises/{eid}/engine/reset")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_complete_engine(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid)
    resp = await client.post(f"/api/exercises/{eid}/engine/complete")
    assert resp.status_code == 200


# ── Speed ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_set_speed(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid)
    resp = await client.put(
        f"/api/exercises/{eid}/engine/speed", json={"factor": 2.0},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_set_speed_invalid_factor(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid)
    resp = await client.put(
        f"/api/exercises/{eid}/engine/speed", json={"factor": -1},
    )
    assert resp.status_code == 422


# ── Snapshot ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_snapshot(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid)
    resp = await client.get(f"/api/exercises/{eid}/engine/snapshot")
    assert resp.status_code == 200
    assert isinstance(resp.json(), dict)


@pytest.mark.asyncio
async def test_get_snapshot_no_engine_404(client: AsyncClient) -> None:
    resp = await client.get("/api/exercises/99999/engine/snapshot")
    assert resp.status_code == 404


# ── Context ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_engine_context(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid)
    resp = await client.get(f"/api/exercises/{eid}/engine/context")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Ctx"
    assert data["briefing"] == "Brief"
    assert data["objectives"] == ["obj1"]
    assert "default_time_factor" in data
