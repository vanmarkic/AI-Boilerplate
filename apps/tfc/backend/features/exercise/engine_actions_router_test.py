"""Tests for engine entity action endpoints (P2: pause/resume/delay/skip injects, session code)."""
from __future__ import annotations

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock

from engine.inject_scheduler import InjectType, ScheduledInject
from engine.exercise_engine import EngineConfig
from engine.defect_manager import TrackedDefect, TriggerMode
from engine.session_store import session_store


def _config(exercise_id: int = 1, injects: list | None = None) -> EngineConfig:
    return EngineConfig(
        exercise_id=exercise_id,
        title="Test",
        injects=injects or [
            ScheduledInject(
                id="e1", title="E1", description="",
                inject_type=InjectType.OPERATIONAL,
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
    """Create an engine with a running inject for testing."""
    from unittest.mock import patch
    config = _config(exercise_id)
    engine = session_store.create(config)
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
        engine._injects.tick(0.0)  # -> pending
        engine._injects.tick(0.0)  # -> running
    engine._phase = engine._phase.__class__("running")


# ── 404 when no engine ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_trigger_inject_no_engine_404(client: AsyncClient) -> None:
    resp = await client.post("/api/exercises/9999/engine/injects/e1/trigger")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_pause_inject_no_engine_404(client: AsyncClient) -> None:
    resp = await client.post("/api/exercises/9999/engine/injects/e1/pause")
    assert resp.status_code == 404


# ── Inject pause/resume ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pause_running_inject(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _start_engine(eid)
    resp = await client.post(f"/api/exercises/{eid}/engine/injects/e1/pause")
    assert resp.status_code == 200
    assert resp.json()["action"] == "paused"


@pytest.mark.asyncio
async def test_resume_paused_inject(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _start_engine(eid)
    await client.post(f"/api/exercises/{eid}/engine/injects/e1/pause")
    resp = await client.post(f"/api/exercises/{eid}/engine/injects/e1/resume")
    assert resp.status_code == 200
    assert resp.json()["action"] == "resumed"


@pytest.mark.asyncio
async def test_pause_non_running_inject_404(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _start_engine(eid)
    # e1 is running, pause it first
    await client.post(f"/api/exercises/{eid}/engine/injects/e1/pause")
    # pausing a paused inject should 404
    resp = await client.post(f"/api/exercises/{eid}/engine/injects/e1/pause")
    assert resp.status_code == 404


# ── Inject delay/skip ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delay_scheduled_inject(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    config = EngineConfig(
        exercise_id=eid, title="T",
        injects=[ScheduledInject(
            id="e2", title="E2", description="",
            inject_type=InjectType.OPERATIONAL, scheduled_pt_ms=9999.0,
        )],
    )
    session_store.create(config)
    resp = await client.post(
        f"/api/exercises/{eid}/engine/injects/e2/delay",
        json={"delay_ms": 5000},
    )
    assert resp.status_code == 200
    assert resp.json()["action"] == "delayed"


@pytest.mark.asyncio
async def test_skip_inject(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _start_engine(eid)
    resp = await client.post(f"/api/exercises/{eid}/engine/injects/e1/skip")
    assert resp.status_code == 200
    assert resp.json()["action"] == "skipped"


@pytest.mark.asyncio
async def test_skip_completed_inject_404(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _start_engine(eid)
    await client.post(f"/api/exercises/{eid}/engine/injects/e1/complete")
    resp = await client.post(f"/api/exercises/{eid}/engine/injects/e1/skip")
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


# ── Broadcast (audit) tests ───────────────────────────────────────────────


def _start_engine_with_callback(
    exercise_id: int,
    on_state_change: AsyncMock,
    defect_id: str | None = None,
) -> None:
    """Create a running engine with an inject (and optional manual defect)."""
    from unittest.mock import patch

    injects = [
        ScheduledInject(
            id="e1", title="E1", description="",
            inject_type=InjectType.OPERATIONAL,
            scheduled_pt_ms=0.0, duration_ms=99999.0,
        ),
    ]
    defects: list[TrackedDefect] = []
    if defect_id:
        defects.append(TrackedDefect(
            id=defect_id, title="D1", description="",
            trigger_mode=TriggerMode.MANUAL,
        ))
    config = EngineConfig(
        exercise_id=exercise_id,
        title="Broadcast Test",
        injects=injects,
        defects=defects,
    )
    session_store.remove(exercise_id)
    engine = session_store.create(config, on_state_change=on_state_change)
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
        engine._injects.tick(0.0)
        engine._injects.tick(0.0)
    engine._phase = engine._phase.__class__("running")


@pytest.mark.asyncio
async def test_cancel_inject_broadcasts(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    cb = AsyncMock()
    _start_engine_with_callback(eid, cb)
    # skip to COMPLETED so cancel isn't an option; pause first then cancel
    await client.post(f"/api/exercises/{eid}/engine/injects/e1/pause")
    cb.reset_mock()
    resp = await client.post(f"/api/exercises/{eid}/engine/injects/e1/cancel")
    assert resp.status_code == 200
    cb.assert_awaited_once()


@pytest.mark.asyncio
async def test_complete_inject_broadcasts(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    cb = AsyncMock()
    _start_engine_with_callback(eid, cb)
    cb.reset_mock()
    resp = await client.post(f"/api/exercises/{eid}/engine/injects/e1/complete")
    assert resp.status_code == 200
    cb.assert_awaited_once()


@pytest.mark.asyncio
async def test_pause_inject_broadcasts(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    cb = AsyncMock()
    _start_engine_with_callback(eid, cb)
    cb.reset_mock()
    resp = await client.post(f"/api/exercises/{eid}/engine/injects/e1/pause")
    assert resp.status_code == 200
    cb.assert_awaited_once()


@pytest.mark.asyncio
async def test_resume_inject_broadcasts(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    cb = AsyncMock()
    _start_engine_with_callback(eid, cb)
    await client.post(f"/api/exercises/{eid}/engine/injects/e1/pause")
    cb.reset_mock()
    resp = await client.post(f"/api/exercises/{eid}/engine/injects/e1/resume")
    assert resp.status_code == 200
    cb.assert_awaited_once()


@pytest.mark.asyncio
async def test_delay_inject_broadcasts(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    cb = AsyncMock()
    # Use a future-scheduled inject so delay is valid
    config = EngineConfig(
        exercise_id=eid, title="T",
        injects=[ScheduledInject(
            id="e2", title="E2", description="",
            inject_type=InjectType.OPERATIONAL, scheduled_pt_ms=99999.0,
        )],
    )
    session_store.remove(eid)
    session_store.create(config, on_state_change=cb)
    resp = await client.post(
        f"/api/exercises/{eid}/engine/injects/e2/delay",
        json={"delay_ms": 5000},
    )
    assert resp.status_code == 200
    cb.assert_awaited_once()


@pytest.mark.asyncio
async def test_skip_inject_broadcasts(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    cb = AsyncMock()
    _start_engine_with_callback(eid, cb)
    cb.reset_mock()
    resp = await client.post(f"/api/exercises/{eid}/engine/injects/e1/skip")
    assert resp.status_code == 200
    cb.assert_awaited_once()


@pytest.mark.asyncio
async def test_activate_defect_broadcasts(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    cb = AsyncMock()
    _start_engine_with_callback(eid, cb, defect_id="d1")
    cb.reset_mock()
    resp = await client.post(f"/api/exercises/{eid}/engine/defects/d1/activate")
    assert resp.status_code == 200
    cb.assert_awaited_once()


@pytest.mark.asyncio
async def test_mitigate_defect_broadcasts(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    cb = AsyncMock()
    _start_engine_with_callback(eid, cb, defect_id="d1")
    engine = session_store.get(eid)
    assert engine is not None
    engine.defect_manager.manual_activate("d1", 0.0)
    cb.reset_mock()
    resp = await client.post(f"/api/exercises/{eid}/engine/defects/d1/mitigate")
    assert resp.status_code == 200
    cb.assert_awaited_once()


@pytest.mark.asyncio
async def test_resolve_defect_broadcasts(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    cb = AsyncMock()
    _start_engine_with_callback(eid, cb, defect_id="d1")
    engine = session_store.get(eid)
    assert engine is not None
    engine.defect_manager.manual_activate("d1", 0.0)
    cb.reset_mock()
    resp = await client.post(f"/api/exercises/{eid}/engine/defects/d1/resolve")
    assert resp.status_code == 200
    cb.assert_awaited_once()


@pytest.mark.asyncio
async def test_release_defect_broadcasts(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    cb = AsyncMock()
    _start_engine_with_callback(eid, cb, defect_id="d1")
    engine = session_store.get(eid)
    assert engine is not None
    engine.defect_manager.manual_activate("d1", 0.0)
    cb.reset_mock()
    resp = await client.post(f"/api/exercises/{eid}/engine/defects/d1/release")
    assert resp.status_code == 200
    cb.assert_awaited_once()


# ── Helpers ──────────────────────────────────────────────────────────────


async def _create_exercise(client: AsyncClient) -> int:
    resp = await client.post("/api/exercises", json={"title": "Test Ex"})
    assert resp.status_code == 201
    return resp.json()["id"]
