"""End-to-end test: create scenario → create exercise → start engine → verify.

Tests the full lifecycle of loading a scenario with events, issues, and
decision templates into an engine via the REST API.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from engine.session_store import session_store


SCENARIO_CONTENT = {
    "phases": [],
    "events": [
        {
            "id": "evt-1",
            "title": "Initial Incident",
            "description": "A security breach",
            "event_type": "operational",
            "scheduled_pt_ms": 0,
            "duration_ms": 5000,
            "triggered_issues": ["iss-1"],
        },
        {
            "id": "evt-decision",
            "title": "Decision Point",
            "event_type": "decision",
            "scheduled_pt_ms": 60000,
        },
    ],
    "issues": [
        {
            "id": "iss-1",
            "title": "Data Leak",
            "trigger_mode": "event-based",
            "trigger_event_id": "evt-1",
        },
    ],
    "decision_templates": [
        {
            "id": "evt-decision",
            "title": "Respond to breach",
            "issue_id": "iss-1",
            "question_type": "single_choice",
            "options": [
                {"id": "isolate", "label": "Isolate", "score": 10},
                {"id": "ignore", "label": "Ignore", "score": 0},
            ],
            "completion_mode": "gm_closes",
        },
    ],
    "briefing": "Respond to a simulated cyber incident.",
    "objectives": ["Contain the breach"],
    "default_time_factor": 1.0,
    "game_mode": "classic",
    "roles": [
        {"id": "co", "label": "CO", "player_type": "decision_maker"},
    ],
}


@pytest.fixture(autouse=True)
def _cleanup_sessions():
    yield
    for eid in list(session_store._sessions.keys()):
        engine = session_store.get(eid)
        if engine:
            engine._stop_tick_loop()
            engine._stop_timeout_monitor()
        session_store.remove(eid)


@pytest.mark.asyncio
async def test_scenario_to_engine_lifecycle(client: AsyncClient) -> None:
    """Full flow: scenario → exercise → engine start → snapshot → complete."""
    # 1. Create scenario with full content
    sc_resp = await client.post("/api/scenarios", json={
        "title": "Cyber Incident",
        "content": SCENARIO_CONTENT,
    })
    assert sc_resp.status_code == 201
    scenario_id = sc_resp.json()["id"]

    # 2. Create exercise linked to scenario
    ex_resp = await client.post("/api/exercises", json={
        "title": "Live Exercise",
        "scenario_id": scenario_id,
    })
    assert ex_resp.status_code == 201
    exercise_id = ex_resp.json()["id"]

    # 3. Start engine — should load scenario content
    start_resp = await client.post(
        f"/api/exercises/{exercise_id}/engine/start",
    )
    assert start_resp.status_code == 200
    assert start_resp.json()["phase"] == "running"

    # 4. Verify snapshot has loaded events and issues
    snap = await client.get(
        f"/api/exercises/{exercise_id}/engine/snapshot",
    )
    assert snap.status_code == 200
    data = snap.json()
    assert data["phase"] == "running"
    assert len(data["events"]) == 2
    assert len(data["issues"]) == 1
    event_ids = [e["id"] for e in data["events"]]
    assert "evt-1" in event_ids
    assert "evt-decision" in event_ids

    # 5. Verify engine context has briefing and objectives
    ctx = await client.get(
        f"/api/exercises/{exercise_id}/engine/context",
    )
    assert ctx.status_code == 200
    assert ctx.json()["briefing"] == "Respond to a simulated cyber incident."
    assert ctx.json()["objectives"] == ["Contain the breach"]

    # 6. Pause then complete
    pause_resp = await client.post(
        f"/api/exercises/{exercise_id}/engine/pause",
    )
    assert pause_resp.json()["phase"] == "paused"

    complete_resp = await client.post(
        f"/api/exercises/{exercise_id}/engine/complete",
    )
    assert complete_resp.json()["phase"] == "completed"

    # 7. Verify snapshot reflects completed state
    final_snap = await client.get(
        f"/api/exercises/{exercise_id}/engine/snapshot",
    )
    assert final_snap.json()["phase"] == "completed"


@pytest.mark.asyncio
async def test_exercise_without_scenario_rejects_start(
    client: AsyncClient,
) -> None:
    """Exercise with no scenario_id cannot be started."""
    ex_resp = await client.post("/api/exercises", json={"title": "Bare Ex"})
    exercise_id = ex_resp.json()["id"]

    start_resp = await client.post(
        f"/api/exercises/{exercise_id}/engine/start",
    )
    assert start_resp.status_code == 422


@pytest.mark.asyncio
async def test_reset_reloads_initial_state(client: AsyncClient) -> None:
    """After reset, engine returns to setup with original events."""
    sc_resp = await client.post("/api/scenarios", json={
        "title": "Reset Scenario",
        "content": SCENARIO_CONTENT,
    })
    scenario_id = sc_resp.json()["id"]

    ex_resp = await client.post("/api/exercises", json={
        "title": "Reset Ex",
        "scenario_id": scenario_id,
    })
    exercise_id = ex_resp.json()["id"]

    await client.post(f"/api/exercises/{exercise_id}/engine/start")
    reset_resp = await client.post(
        f"/api/exercises/{exercise_id}/engine/reset",
    )
    assert reset_resp.json()["phase"] == "setup"

    snap = await client.get(
        f"/api/exercises/{exercise_id}/engine/snapshot",
    )
    assert snap.json()["phase"] == "setup"
    assert len(snap.json()["events"]) == 2
