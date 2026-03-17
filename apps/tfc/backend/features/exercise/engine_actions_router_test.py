"""Tests for engine entity action endpoints (P2: pause/resume/delay/skip events, session code)."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import EngineConfig
from engine.session_store import session_store


def _config(exercise_id: int = 1, events: list | None = None) -> EngineConfig:
    return EngineConfig(
        exercise_id=exercise_id,
        title="Test",
        events=events or [
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


def _start_engine(exercise_id: int = 1) -> None:
    """Create an engine with a running event for testing."""
    from unittest.mock import patch
    config = _config(exercise_id)
    engine = session_store.create(config)
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
        engine._events.tick(0.0)  # -> pending
        engine._events.tick(0.0)  # -> running
    engine._phase = engine._phase.__class__("running")


# ── 404 when no engine ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_trigger_event_no_engine_404(client: AsyncClient) -> None:
    resp = await client.post("/api/exercises/9999/engine/events/e1/trigger")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_pause_event_no_engine_404(client: AsyncClient) -> None:
    resp = await client.post("/api/exercises/9999/engine/events/e1/pause")
    assert resp.status_code == 404


# ── Event pause/resume ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pause_running_event(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _start_engine(eid)
    resp = await client.post(f"/api/exercises/{eid}/engine/events/e1/pause")
    assert resp.status_code == 200
    assert resp.json()["action"] == "paused"


@pytest.mark.asyncio
async def test_resume_paused_event(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _start_engine(eid)
    await client.post(f"/api/exercises/{eid}/engine/events/e1/pause")
    resp = await client.post(f"/api/exercises/{eid}/engine/events/e1/resume")
    assert resp.status_code == 200
    assert resp.json()["action"] == "resumed"


@pytest.mark.asyncio
async def test_pause_non_running_event_404(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _start_engine(eid)
    # e1 is running, pause it first
    await client.post(f"/api/exercises/{eid}/engine/events/e1/pause")
    # pausing a paused event should 404
    resp = await client.post(f"/api/exercises/{eid}/engine/events/e1/pause")
    assert resp.status_code == 404


# ── Event delay/skip ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delay_scheduled_event(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    config = EngineConfig(
        exercise_id=eid, title="T",
        events=[ScheduledEvent(
            id="e2", title="E2", description="",
            event_type=EventType.OPERATIONAL, scheduled_pt_ms=9999.0,
        )],
    )
    session_store.create(config)
    resp = await client.post(
        f"/api/exercises/{eid}/engine/events/e2/delay",
        json={"delay_ms": 5000},
    )
    assert resp.status_code == 200
    assert resp.json()["action"] == "delayed"


@pytest.mark.asyncio
async def test_skip_event(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _start_engine(eid)
    resp = await client.post(f"/api/exercises/{eid}/engine/events/e1/skip")
    assert resp.status_code == 200
    assert resp.json()["action"] == "skipped"


@pytest.mark.asyncio
async def test_skip_completed_event_404(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _start_engine(eid)
    await client.post(f"/api/exercises/{eid}/engine/events/e1/complete")
    resp = await client.post(f"/api/exercises/{eid}/engine/events/e1/skip")
    assert resp.status_code == 404


# ── Session code lookup ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_exercise_returns_session_code(client: AsyncClient) -> None:
    resp = await client.post("/api/exercises", json={"title": "Code Test"})
    assert resp.status_code == 201
    data = resp.json()
    assert "session_code" in data
    assert len(data["session_code"]) == 6


@pytest.mark.asyncio
async def test_lookup_by_session_code(client: AsyncClient) -> None:
    create_resp = await client.post("/api/exercises", json={"title": "Code Lookup"})
    code = create_resp.json()["session_code"]
    resp = await client.get(f"/api/exercises/by-code/{code}")
    assert resp.status_code == 200
    assert resp.json()["session_code"] == code


@pytest.mark.asyncio
async def test_lookup_by_session_code_case_insensitive(client: AsyncClient) -> None:
    create_resp = await client.post("/api/exercises", json={"title": "Case Test"})
    code = create_resp.json()["session_code"]
    resp = await client.get(f"/api/exercises/by-code/{code.lower()}")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_lookup_by_invalid_code_404(client: AsyncClient) -> None:
    resp = await client.get("/api/exercises/by-code/XXXXXX")
    assert resp.status_code == 404


# ── Helpers ──────────────────────────────────────────────────────────────


async def _create_exercise(client: AsyncClient) -> int:
    resp = await client.post("/api/exercises", json={"title": "Test Ex"})
    assert resp.status_code == 201
    return resp.json()["id"]
