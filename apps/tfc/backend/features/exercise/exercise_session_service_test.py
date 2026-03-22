"""Tests for ExerciseSessionService — stop/cleanup orchestration."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from engine.engine_config import EngineConfig, ScenarioContext
from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import EnginePhase
from engine.session_store import SessionStore, session_store
from features.exercise.adapters.connection_manager import ConnectionManager
from features.exercise.exercise_session_service import ExerciseSessionService
from features.waiting_room.waiting_room_store import WaitingRoomStore


def _config(exercise_id: int = 1) -> EngineConfig:
    return EngineConfig(
        exercise_id=exercise_id,
        title="Test",
        context=ScenarioContext(
            title="Ctx",
            description="Desc",
            briefing="Brief",
            objectives=["obj1"],
            rules=["rule1"],
        ),
        events=[
            ScheduledEvent(
                id="e1",
                title="E1",
                description="",
                event_type=EventType.OPERATIONAL,
                scheduled_pt_ms=0.0,
                duration_ms=99999.0,
            ),
        ],
    )


@pytest.fixture(autouse=True)
def _cleanup_sessions() -> None:
    yield
    for eid in list(session_store._sessions.keys()):
        engine = session_store.get(eid)
        if engine:
            engine._stop_tick_loop()
            engine._stop_timeout_monitor()
        session_store.remove(eid)


class TestExerciseSessionService:
    """Unit tests for ExerciseSessionService.stop()."""

    async def test_stop_completes_engine(self) -> None:
        store = SessionStore()
        conn_mgr = ConnectionManager()
        wr_store = WaitingRoomStore()
        engine = store.create(_config(1))
        await engine.start()
        await engine.begin()
        assert engine.phase == EnginePhase.RUNNING

        svc = ExerciseSessionService(store, conn_mgr, wr_store)
        await svc.stop(1)

        assert engine.phase == EnginePhase.COMPLETED

    async def test_stop_removes_from_session_store(self) -> None:
        store = SessionStore()
        conn_mgr = ConnectionManager()
        wr_store = WaitingRoomStore()
        store.create(_config(1))

        svc = ExerciseSessionService(store, conn_mgr, wr_store)
        await svc.stop(1)

        assert store.get(1) is None

    async def test_stop_clears_waiting_room(self) -> None:
        store = SessionStore()
        conn_mgr = ConnectionManager()
        wr_store = WaitingRoomStore()
        wr_store.join(1, "Alice", "player")
        wr_store.join(1, "Bob", "advisor")
        assert wr_store.count(1) == 2

        svc = ExerciseSessionService(store, conn_mgr, wr_store)
        await svc.stop(1)

        assert wr_store.count(1) == 0

    async def test_stop_broadcasts_exercise_stopped(self) -> None:
        store = SessionStore()
        conn_mgr = ConnectionManager()
        conn_mgr.broadcast = AsyncMock()
        conn_mgr.close_all = AsyncMock(return_value=0)
        wr_store = WaitingRoomStore()

        svc = ExerciseSessionService(store, conn_mgr, wr_store)
        await svc.stop(42, reason="stopped_by_gm")

        conn_mgr.broadcast.assert_called_once_with(
            42,
            {
                "type": "exercise_stopped",
                "exercise_id": 42,
                "reason": "stopped_by_gm",
            },
        )

    async def test_stop_closes_all_websockets(self) -> None:
        store = SessionStore()
        conn_mgr = ConnectionManager()
        conn_mgr.broadcast = AsyncMock()
        conn_mgr.close_all = AsyncMock(return_value=3)
        wr_store = WaitingRoomStore()

        svc = ExerciseSessionService(store, conn_mgr, wr_store)
        await svc.stop(1)

        conn_mgr.close_all.assert_called_once_with(1)

    async def test_stop_idempotent_on_completed_engine(self) -> None:
        store = SessionStore()
        conn_mgr = ConnectionManager()
        wr_store = WaitingRoomStore()
        engine = store.create(_config(1))
        await engine.start()
        await engine.begin()
        await engine.complete()
        assert engine.phase == EnginePhase.COMPLETED

        svc = ExerciseSessionService(store, conn_mgr, wr_store)
        await svc.stop(1)  # Should not raise

        assert store.get(1) is None

    async def test_stop_idempotent_with_no_engine(self) -> None:
        store = SessionStore()
        conn_mgr = ConnectionManager()
        conn_mgr.broadcast = AsyncMock()
        conn_mgr.close_all = AsyncMock(return_value=0)
        wr_store = WaitingRoomStore()

        svc = ExerciseSessionService(store, conn_mgr, wr_store)
        await svc.stop(999)  # Should not raise

    async def test_stop_with_completed_reason(self) -> None:
        store = SessionStore()
        conn_mgr = ConnectionManager()
        conn_mgr.broadcast = AsyncMock()
        conn_mgr.close_all = AsyncMock(return_value=0)
        wr_store = WaitingRoomStore()

        svc = ExerciseSessionService(store, conn_mgr, wr_store)
        await svc.stop(1, reason="completed")

        conn_mgr.broadcast.assert_called_once_with(
            1,
            {
                "type": "exercise_stopped",
                "exercise_id": 1,
                "reason": "completed",
            },
        )


class TestConnectionManagerCloseAll:
    """Unit tests for ConnectionManager.close_all()."""

    async def test_close_all_returns_count(self) -> None:
        mgr = ConnectionManager()
        ws1, ws2 = AsyncMock(), AsyncMock()
        mgr.connect(1, ws1, "gm")
        mgr.connect(1, ws2, "player", "p1")

        closed = await mgr.close_all(1)

        assert closed == 2
        ws1.close.assert_called_once()
        ws2.close.assert_called_once()

    async def test_close_all_removes_connections(self) -> None:
        mgr = ConnectionManager()
        mgr.connect(1, AsyncMock(), "gm")

        await mgr.close_all(1)

        assert mgr.get_connections(1) == []

    async def test_close_all_no_connections(self) -> None:
        mgr = ConnectionManager()
        closed = await mgr.close_all(999)
        assert closed == 0

    async def test_close_all_handles_close_error(self) -> None:
        mgr = ConnectionManager()
        ws = AsyncMock()
        ws.close.side_effect = RuntimeError("already closed")
        mgr.connect(1, ws, "player")

        closed = await mgr.close_all(1)

        assert closed == 0
        assert mgr.get_connections(1) == []


class TestStopEngineEndpoint:
    """Integration tests for POST /engine/stop."""

    async def _create_exercise_with_scenario(self, client: AsyncClient) -> int:
        sc = await client.post(
            "/api/scenarios",
            json={
                "title": "Stop Scenario",
                "content": {
                    "game_mode": "classic",
                    "roles": [
                        {"id": "co", "label": "CO", "player_type": "decision_maker"},
                    ],
                },
            },
        )
        assert sc.status_code == 201
        resp = await client.post(
            "/api/exercises",
            json={"title": "Stop Test", "scenario_id": sc.json()["id"]},
        )
        assert resp.status_code == 201
        return resp.json()["id"]

    async def test_stop_returns_success(self, client: AsyncClient) -> None:
        eid = await self._create_exercise_with_scenario(client)
        await client.post(f"/api/exercises/{eid}/engine/start")

        resp = await client.post(f"/api/exercises/{eid}/engine/stop")

        assert resp.status_code == 200
        assert resp.json() == {"stopped": True}

    async def test_stop_removes_session(self, client: AsyncClient) -> None:
        eid = await self._create_exercise_with_scenario(client)
        await client.post(f"/api/exercises/{eid}/engine/start")
        assert session_store.get(eid) is not None

        await client.post(f"/api/exercises/{eid}/engine/stop")

        assert session_store.get(eid) is None

    async def test_stop_clears_waiting_room(self, client: AsyncClient) -> None:
        from features.waiting_room.waiting_room_store import waiting_room_store

        eid = await self._create_exercise_with_scenario(client)
        waiting_room_store.join(eid, "Alice", "player")
        await client.post(f"/api/exercises/{eid}/engine/start")

        await client.post(f"/api/exercises/{eid}/engine/stop")

        assert waiting_room_store.count(eid) == 0

    async def test_stop_idempotent(self, client: AsyncClient) -> None:
        eid = await self._create_exercise_with_scenario(client)
        await client.post(f"/api/exercises/{eid}/engine/start")
        await client.post(f"/api/exercises/{eid}/engine/stop")

        resp = await client.post(f"/api/exercises/{eid}/engine/stop")

        assert resp.status_code == 200

    async def test_complete_also_cleans_up(self, client: AsyncClient) -> None:
        eid = await self._create_exercise_with_scenario(client)
        await client.post(f"/api/exercises/{eid}/engine/start")
        # Begin to get into RUNNING (complete requires non-SETUP phase)
        engine = session_store.get(eid)
        assert engine is not None
        await engine.begin()

        resp = await client.post(f"/api/exercises/{eid}/engine/complete")

        assert resp.status_code == 200
        # Engine stays alive after complete (for completion overlay)
        engine_after = session_store.get(eid)
        assert engine_after is not None
        assert engine_after.phase.value == "completed"
