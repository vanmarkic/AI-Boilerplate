"""Gray-box tests for engine state machine transitions at the HTTP level.

Verifies that invalid phase transitions return error responses and valid
transitions succeed, ensuring the API enforces the engine's state rules.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from httpx import AsyncClient

from engine.engine_config import EngineConfig
from engine.session_store import session_store


@pytest.fixture(autouse=True)
def _cleanup_sessions() -> None:
    yield
    for eid in list(session_store._sessions.keys()):
        engine = session_store.get(eid)
        if engine:
            engine._stop_tick_loop()
            engine._stop_timeout_monitor()
        session_store.remove(eid)


def _create_engine(exercise_id: int, phase: str = "running") -> None:
    config = EngineConfig(exercise_id=exercise_id, title="SM Test")
    engine = session_store.create(config)
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = phase != "running"
    engine._phase = engine._phase.__class__(phase)


async def _create_exercise(client: AsyncClient) -> int:
    resp = await client.post("/api/exercises", json={"title": "SM Ex"})
    assert resp.status_code == 201
    return resp.json()["id"]


# ── Pause from non-RUNNING states ───────────────────────────────────────


@pytest.mark.asyncio
async def test_pause_from_paused_returns_error(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid, "paused")
    resp = await client.post(f"/api/exercises/{eid}/engine/pause")
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_pause_from_setup_returns_error(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid, "setup")
    resp = await client.post(f"/api/exercises/{eid}/engine/pause")
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_pause_from_completed_returns_error(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid, "completed")
    resp = await client.post(f"/api/exercises/{eid}/engine/pause")
    assert resp.status_code == 409


# ── Complete from invalid states ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_complete_from_setup_returns_error(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid, "setup")
    resp = await client.post(f"/api/exercises/{eid}/engine/complete")
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_complete_from_completed_returns_error(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid, "completed")
    resp = await client.post(f"/api/exercises/{eid}/engine/complete")
    assert resp.status_code == 409


# ── Start/Resume from invalid states ────────────────────────────────────


@pytest.mark.asyncio
async def test_start_from_running_is_idempotent(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid, "running")
    resp = await client.post(f"/api/exercises/{eid}/engine/start")
    assert resp.status_code == 200
    assert resp.json()["phase"] == "running"


@pytest.mark.asyncio
async def test_start_from_completed_returns_error(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid, "completed")
    resp = await client.post(f"/api/exercises/{eid}/engine/start")
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_resume_from_completed_returns_error(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid, "completed")
    resp = await client.post(f"/api/exercises/{eid}/engine/resume")
    assert resp.status_code == 409


# ── Valid transitions produce phase changes ──────────────────────────────


@pytest.mark.asyncio
async def test_start_from_setup_succeeds(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid, "setup")
    resp = await client.post(f"/api/exercises/{eid}/engine/start")
    data = resp.json()
    assert "error" not in data
    assert data["phase"] == "briefing"


@pytest.mark.asyncio
async def test_pause_resume_cycle(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid, "running")

    pause_resp = await client.post(f"/api/exercises/{eid}/engine/pause")
    assert pause_resp.json()["phase"] == "paused"

    resume_resp = await client.post(f"/api/exercises/{eid}/engine/resume")
    assert resume_resp.json()["phase"] == "running"


@pytest.mark.asyncio
async def test_complete_from_running_succeeds(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid, "running")
    resp = await client.post(f"/api/exercises/{eid}/engine/complete")
    data = resp.json()
    assert data["phase"] == "completed"


@pytest.mark.asyncio
async def test_complete_from_paused_succeeds(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid, "paused")
    resp = await client.post(f"/api/exercises/{eid}/engine/complete")
    data = resp.json()
    assert data["phase"] == "completed"


# ── Reset always succeeds ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_reset_from_running(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid, "running")
    resp = await client.post(f"/api/exercises/{eid}/engine/reset")
    assert resp.json()["phase"] == "setup"


@pytest.mark.asyncio
async def test_reset_from_completed(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid, "completed")
    resp = await client.post(f"/api/exercises/{eid}/engine/reset")
    assert resp.json()["phase"] == "setup"


# ── Snapshot reflects current phase ──────────────────────────────────────


@pytest.mark.asyncio
async def test_snapshot_reflects_phase_after_transitions(
    client: AsyncClient,
) -> None:
    eid = await _create_exercise(client)
    _create_engine(eid, "running")

    snap = await client.get(f"/api/exercises/{eid}/engine/snapshot")
    assert snap.json()["phase"] == "running"

    await client.post(f"/api/exercises/{eid}/engine/pause")
    snap = await client.get(f"/api/exercises/{eid}/engine/snapshot")
    assert snap.json()["phase"] == "paused"
