"""Integration tests verifying REST engine actions trigger correct broadcasts.

Uses a mock on connection_manager to capture broadcast calls and verify
that the right state changes are sent to clients after engine actions.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch

from engine.engine_config import DecisionTemplate, EngineConfig, ScenarioContext
from engine.event_scheduler import EventType, ScheduledEvent
from engine.game_modes.simple_collaborative import SimpleCollaborativeMode
from engine.session_store import session_store


OPTIONS = [
    {"id": "good", "label": "Good", "score": 10},
    {"id": "bad", "label": "Bad", "score": 0},
]


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
    scenario_resp = await client.post(
        "/api/scenarios",
        json={
            "title": "Broadcast Scenario",
            "content": {
                "game_mode": "simple_collaborative",
                "roles": [
                    {"id": "co", "label": "CO", "player_type": "decision_maker"},
                    {"id": "ops", "label": "OPS", "player_type": "advisor"},
                ],
            },
        },
    )
    assert scenario_resp.status_code == 201
    sid = scenario_resp.json()["id"]
    resp = await client.post(
        "/api/exercises",
        json={
            "title": "Broadcast Ex",
            "scenario_id": sid,
            "game_mode": "simple_collaborative",
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_start_engine_broadcasts_via_on_state_change(
    client: AsyncClient,
) -> None:
    """Starting engine via REST wires up the on_state_change callback."""
    eid = await _create_exercise(client)

    mock_broadcast = AsyncMock()
    with patch(
        "features.exercise.engine_router.connection_manager"
    ) as mock_mgr:
        mock_mgr.broadcast = mock_broadcast
        resp = await client.post(f"/api/exercises/{eid}/engine/start")
        assert resp.status_code == 200

    # Engine should exist and have the broadcast callback wired
    engine = session_store.get(eid)
    assert engine is not None
    assert engine._on_state_change is not None


@pytest.mark.asyncio
async def test_close_decision_broadcasts_score_change(
    client: AsyncClient,
) -> None:
    """Closing a decision in collaborative mode broadcasts score changes."""
    eid = await _create_exercise(client)
    t1 = DecisionTemplate(
        id="d1", title="D1", description="",
        issue_id="iss-1", question_type="single_choice",
        options=OPTIONS, completion_mode="gm_closes",
    )
    mode = SimpleCollaborativeMode(
        decision_sequence=["d1"],
        base_decision_time_ms=60_000,
    )
    config = EngineConfig(
        exercise_id=eid, title="Broadcast",
        decision_templates=[t1], game_mode=mode,
    )
    engine = session_store.create(config)
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
    engine._phase = engine._phase.__class__("running")
    engine._decisions.open_decision(
        id="d1", event_id=None, issue_id="iss-1",
        title="D1", description="", question_type="single_choice",
        options=OPTIONS, completion_mode="gm_closes",
        target_roles=[], timeout_ms=0, current_pt_ms=0.0,
    )

    mock_broadcast = AsyncMock()
    with patch(
        "features.exercise.engine_router.connection_manager"
    ) as mock_mgr:
        mock_mgr.broadcast = mock_broadcast
        mock_mgr.broadcast_to_role = AsyncMock()
        resp = await client.post(
            f"/api/exercises/{eid}/engine/decisions/d1/close",
            json={"selected_option_ids": ["bad"]},
        )
        assert resp.status_code == 200

    # Should have broadcast score_change
    assert mock_broadcast.called
    call_args = mock_broadcast.call_args
    msg = call_args[0][1]  # (exercise_id, message)
    changes = msg["changes"]
    change_types = [c["type"] for c in changes]
    assert "score_change" in change_types


@pytest.mark.asyncio
async def test_close_decision_with_forced_card_broadcasts_forced_applied(
    client: AsyncClient,
) -> None:
    """Forced card enforcement triggers forced_card_applied broadcast."""
    eid = await _create_exercise(client)
    forced_opts = [
        {"id": "good", "label": "Good", "score": 10},
        {"id": "forced", "label": "Forced", "score": -5},
    ]
    t1 = DecisionTemplate(
        id="d1", title="D1", description="",
        issue_id="iss-1", question_type="single_choice",
        options=forced_opts, completion_mode="gm_closes",
        forced_option_ids=["forced"],
    )
    mode = SimpleCollaborativeMode(decision_sequence=["d1"])
    config = EngineConfig(
        exercise_id=eid, title="Forced",
        decision_templates=[t1], game_mode=mode,
    )
    engine = session_store.create(config)
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
    engine._phase = engine._phase.__class__("running")
    engine._decisions.open_decision(
        id="d1", event_id=None, issue_id="iss-1",
        title="D1", description="", question_type="single_choice",
        options=forced_opts, completion_mode="gm_closes",
        target_roles=[], timeout_ms=0, current_pt_ms=0.0,
    )

    mock_broadcast = AsyncMock()
    with patch(
        "features.exercise.engine_router.connection_manager"
    ) as mock_mgr:
        mock_mgr.broadcast = mock_broadcast
        mock_mgr.broadcast_to_role = AsyncMock()
        # Select "good" only — "forced" should be auto-applied
        await client.post(
            f"/api/exercises/{eid}/engine/decisions/d1/close",
            json={"selected_option_ids": ["good"]},
        )

    assert mock_broadcast.called
    all_changes = []
    for call in mock_broadcast.call_args_list:
        msg = call[0][1]
        all_changes.extend(msg.get("changes", []))
    types = [c["type"] for c in all_changes]
    assert "forced_card_applied" in types


@pytest.mark.asyncio
async def test_recommendation_broadcasts_to_all(
    client: AsyncClient,
) -> None:
    """Submitting a recommendation broadcasts the change to all clients."""
    eid = await _create_exercise(client)
    config = EngineConfig(exercise_id=eid, title="Rec Test")
    engine = session_store.create(config)
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
    engine._phase = engine._phase.__class__("running")
    engine._decisions.open_decision(
        id="d1", event_id=None, issue_id="iss-1",
        title="D1", description="", question_type="single_choice",
        options=OPTIONS, completion_mode="gm_closes",
        target_roles=[], timeout_ms=0, current_pt_ms=0.0,
    )

    mock_broadcast = AsyncMock()
    with patch(
        "features.exercise.engine_router.connection_manager"
    ) as mock_mgr:
        mock_mgr.broadcast = mock_broadcast
        resp = await client.post(
            f"/api/exercises/{eid}/engine/decisions/recommend",
            json={
                "decision_id": "d1",
                "option_id": "good",
                "participant_id": "advisor-1",
            },
        )
        assert resp.status_code == 200

    assert mock_broadcast.called
    msg = mock_broadcast.call_args[0][1]
    assert msg["type"] == "state_changes"
    assert any(
        c.get("type") == "recommendation_submitted"
        for c in msg["changes"]
    )
