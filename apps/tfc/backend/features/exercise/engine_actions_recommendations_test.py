"""Tests for recommendation submission endpoint — all_respond auto-close."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from engine.decision_manager import DecisionManager
from engine.exercise_engine import EnginePhase
from engine.session_store import session_store
from engine.engine_config import EngineConfig, DecisionTemplate


def _make_engine(
    exercise_id: int,
    completion_mode: str = "all_respond",
    target_roles: list[str] | None = None,
) -> None:
    """Create an engine with one open decision."""
    config = EngineConfig(exercise_id=exercise_id, title="Test")
    engine = session_store.create(config)
    engine._decisions.open_decision(
        id="d1",
        inject_id=None,
        defect_id=None,
        title="Decision 1",
        description="",
        question_type="free_text",
        options=[],
        completion_mode=completion_mode,
        target_roles=target_roles if target_roles is not None else ["alpha", "bravo"],
        current_pt_ms=0.0,
    )
    engine._phase = EnginePhase.PAUSED


@pytest.fixture(autouse=True)
def _cleanup_sessions():
    yield
    for eid in list(session_store._sessions.keys()):
        engine = session_store.get(eid)
        if engine:
            engine._stop_tick_loop()
            engine._stop_timeout_monitor()
        session_store.remove(eid)


async def _create_exercise(client: AsyncClient) -> int:
    resp = await client.post("/api/exercises", json={"title": "Test Ex"})
    assert resp.status_code == 201
    return resp.json()["id"]


# ── 404 guard ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_submit_recommendation_no_engine_404(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/exercises/9999/engine/decisions/d1/recommendations",
        json={"role": "alpha", "participant_id": "u1"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_submit_recommendation_unknown_decision_404(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    _make_engine(eid)
    resp = await client.post(
        f"/api/exercises/{eid}/engine/decisions/nonexistent/recommendations",
        json={"role": "alpha", "participant_id": "u1"},
    )
    assert resp.status_code == 404


# ── all_respond auto-close ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_all_respond_does_not_close_when_only_one_role_submitted(
    client: AsyncClient,
) -> None:
    eid = await _create_exercise(client)
    _make_engine(eid, target_roles=["alpha", "bravo"])

    resp = await client.post(
        f"/api/exercises/{eid}/engine/decisions/d1/recommendations",
        json={"role": "alpha", "participant_id": "u1"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["recorded"] is True
    assert data["auto_closed"] is False

    engine = session_store.get(eid)
    assert engine is not None
    assert len(engine.decision_manager.get_open_decisions()) == 1


@pytest.mark.asyncio
async def test_all_respond_auto_closes_when_all_roles_submitted(
    client: AsyncClient,
) -> None:
    eid = await _create_exercise(client)
    _make_engine(eid, target_roles=["alpha", "bravo"])

    await client.post(
        f"/api/exercises/{eid}/engine/decisions/d1/recommendations",
        json={"role": "alpha", "participant_id": "u1"},
    )
    resp = await client.post(
        f"/api/exercises/{eid}/engine/decisions/d1/recommendations",
        json={"role": "bravo", "participant_id": "u2"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["recorded"] is True
    assert data["auto_closed"] is True

    engine = session_store.get(eid)
    assert engine is not None
    assert len(engine.decision_manager.get_open_decisions()) == 0


@pytest.mark.asyncio
async def test_first_response_mode_does_not_auto_close_via_recommendation(
    client: AsyncClient,
) -> None:
    """first_response decisions are not closed by the recommendation endpoint."""
    eid = await _create_exercise(client)
    _make_engine(eid, completion_mode="first_response", target_roles=["alpha"])

    resp = await client.post(
        f"/api/exercises/{eid}/engine/decisions/d1/recommendations",
        json={"role": "alpha", "participant_id": "u1"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["auto_closed"] is False

    engine = session_store.get(eid)
    assert engine is not None
    assert len(engine.decision_manager.get_open_decisions()) == 1


@pytest.mark.asyncio
async def test_all_respond_second_submission_to_closed_decision_returns_404(
    client: AsyncClient,
) -> None:
    """Once auto-closed, a follow-up submission returns 404."""
    eid = await _create_exercise(client)
    _make_engine(eid, target_roles=["solo"])

    await client.post(
        f"/api/exercises/{eid}/engine/decisions/d1/recommendations",
        json={"role": "solo", "participant_id": "u1"},
    )
    resp = await client.post(
        f"/api/exercises/{eid}/engine/decisions/d1/recommendations",
        json={"role": "solo", "participant_id": "u2"},
    )
    assert resp.status_code == 404
