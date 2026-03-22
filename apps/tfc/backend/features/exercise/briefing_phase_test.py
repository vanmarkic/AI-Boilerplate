"""Tests for BRIEFING phase: engine.start() enters BRIEFING, engine.begin() starts gameplay."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from httpx import AsyncClient

from engine.engine_config import EngineConfig, ScenarioContext
from engine.event_scheduler import ScheduledEvent
from engine.exercise_engine import EnginePhase, EngineStateError, ExerciseEngine
from engine.session_store import session_store


def _config(
    events: list[ScheduledEvent] | None = None,
    context: ScenarioContext | None = None,
) -> EngineConfig:
    return EngineConfig(
        exercise_id=1,
        title="Test",
        events=events or [],
        context=context or ScenarioContext(briefing="Read this first."),
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


# ── Unit tests: engine state machine ────────────────────────────────────


class TestBriefingPhaseEngine:
    @pytest.mark.asyncio
    async def test_start_enters_briefing_phase(self) -> None:
        """engine.start() should transition SETUP → BRIEFING, not RUNNING."""
        engine = ExerciseEngine(_config())
        result = await engine.start()
        assert engine.phase == EnginePhase.BRIEFING
        assert result["phase"] == "briefing"
        assert result["action"] == "started"

    @pytest.mark.asyncio
    async def test_start_does_not_start_tick_loop(self) -> None:
        """In BRIEFING phase, the tick loop must NOT be running."""
        engine = ExerciseEngine(_config())
        await engine.start()
        # Tick task should not have been created
        assert engine._tick_task is None or engine._tick_task.done()

    @pytest.mark.asyncio
    async def test_time_does_not_advance_in_briefing(self) -> None:
        """Play time should remain at 0 while in BRIEFING."""
        engine = ExerciseEngine(_config())
        await engine.start()
        assert engine.time_manager.play_time_ms == 0.0

    @pytest.mark.asyncio
    async def test_begin_transitions_to_running(self) -> None:
        """engine.begin() should transition BRIEFING → RUNNING and start the clock."""
        engine = ExerciseEngine(_config())
        await engine.start()
        with patch("engine.time_manager._now_ms", return_value=0.0):
            result = await engine.begin()
        assert engine.phase == EnginePhase.RUNNING
        assert result["phase"] == "running"
        assert result["action"] == "begun"
        engine._stop_tick_loop()

    @pytest.mark.asyncio
    async def test_begin_rejects_from_setup(self) -> None:
        """Cannot begin() from SETUP — must start() first."""
        engine = ExerciseEngine(_config())
        with pytest.raises(EngineStateError):
            await engine.begin()

    @pytest.mark.asyncio
    async def test_begin_rejects_from_running(self) -> None:
        """Cannot begin() if already RUNNING."""
        engine = ExerciseEngine(_config())
        await engine.start()
        with patch("engine.time_manager._now_ms", return_value=0.0):
            await engine.begin()
        with pytest.raises(EngineStateError):
            await engine.begin()
        engine._stop_tick_loop()

    @pytest.mark.asyncio
    async def test_begin_rejects_from_completed(self) -> None:
        """Cannot begin() from COMPLETED."""
        engine = ExerciseEngine(_config())
        await engine.start()
        with patch("engine.time_manager._now_ms", return_value=0.0):
            await engine.begin()
            await engine.complete()
        with pytest.raises(EngineStateError):
            await engine.begin()

    @pytest.mark.asyncio
    async def test_snapshot_shows_briefing_phase(self) -> None:
        """Snapshot should reflect the BRIEFING phase."""
        engine = ExerciseEngine(_config())
        await engine.start()
        snap = engine.snapshot()
        assert snap["phase"] == "briefing"

    @pytest.mark.asyncio
    async def test_context_available_in_briefing(self) -> None:
        """Engine context (briefing text) should be available in BRIEFING phase."""
        ctx = ScenarioContext(
            briefing="You are the crew of a Frigate...",
            objectives=["Maintain mission tempo"],
        )
        engine = ExerciseEngine(_config(context=ctx))
        await engine.start()
        assert engine.config.context.briefing == "You are the crew of a Frigate..."
        assert engine.config.context.objectives == ["Maintain mission tempo"]

    @pytest.mark.asyncio
    async def test_reset_from_briefing_returns_to_setup(self) -> None:
        """Reset from BRIEFING should go back to SETUP."""
        engine = ExerciseEngine(_config())
        await engine.start()
        result = await engine.reset()
        assert engine.phase == EnginePhase.SETUP
        assert result["phase"] == "setup"


# ── HTTP API tests ──────────────────────────────────────────────────────


async def _create_exercise_with_scenario(client: AsyncClient) -> int:
    sc = await client.post(
        "/api/scenarios",
        json={
            "title": "Briefing Scenario",
            "content": {
                "game_mode": "classic",
                "briefing": "Detailed briefing text here.",
                "objectives": ["Survive"],
                "roles": [
                    {"id": "co", "label": "CO", "player_type": "decision_maker"},
                ],
            },
        },
    )
    assert sc.status_code == 201
    resp = await client.post(
        "/api/exercises",
        json={
            "title": "Briefing Test Ex",
            "scenario_id": sc.json()["id"],
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


class TestBriefingPhaseHTTP:
    @pytest.mark.asyncio
    async def test_start_returns_briefing_phase(self, client: AsyncClient) -> None:
        """POST /engine/start should return phase=briefing."""
        eid = await _create_exercise_with_scenario(client)
        resp = await client.post(f"/api/exercises/{eid}/engine/start")
        assert resp.status_code == 200
        assert resp.json()["phase"] == "briefing"

    @pytest.mark.asyncio
    async def test_context_available_after_start(self, client: AsyncClient) -> None:
        """GET /engine/context should work in BRIEFING phase."""
        eid = await _create_exercise_with_scenario(client)
        await client.post(f"/api/exercises/{eid}/engine/start")
        resp = await client.get(f"/api/exercises/{eid}/engine/context")
        assert resp.status_code == 200
        assert resp.json()["briefing"] == "Detailed briefing text here."

    @pytest.mark.asyncio
    async def test_begin_transitions_to_running(self, client: AsyncClient) -> None:
        """POST /engine/begin should transition BRIEFING → RUNNING."""
        eid = await _create_exercise_with_scenario(client)
        await client.post(f"/api/exercises/{eid}/engine/start")
        resp = await client.post(f"/api/exercises/{eid}/engine/begin")
        assert resp.status_code == 200
        assert resp.json()["phase"] == "running"

    @pytest.mark.asyncio
    async def test_begin_without_start_returns_409(self, client: AsyncClient) -> None:
        """POST /engine/begin without prior start should fail."""
        eid = await _create_exercise_with_scenario(client)
        # Start then reset to go back to SETUP
        await client.post(f"/api/exercises/{eid}/engine/start")
        await client.post(f"/api/exercises/{eid}/engine/reset")
        resp = await client.post(f"/api/exercises/{eid}/engine/begin")
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_begin_no_engine_returns_404(self, client: AsyncClient) -> None:
        """POST /engine/begin with no engine should return 404."""
        resp = await client.post("/api/exercises/99999/engine/begin")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_snapshot_shows_briefing_after_start(self, client: AsyncClient) -> None:
        """GET /engine/snapshot after start should show phase=briefing."""
        eid = await _create_exercise_with_scenario(client)
        await client.post(f"/api/exercises/{eid}/engine/start")
        resp = await client.get(f"/api/exercises/{eid}/engine/snapshot")
        assert resp.status_code == 200
        assert resp.json()["phase"] == "briefing"
