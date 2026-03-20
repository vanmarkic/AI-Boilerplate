"""Integration tests for decision chaining and scoring through the HTTP API.

Tests the collaborative game mode flow: close decision D1 → D2 auto-opens
with scoring penalties applied, forced cards enforced, and timeout adjusted.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from httpx import AsyncClient

from engine.engine_config import DecisionTemplate, EngineConfig, ScenarioContext
from engine.game_modes.simple_collaborative import SimpleCollaborativeMode
from engine.session_store import session_store

OPTIONS = [
    {"id": "good", "label": "Good", "score": 10, "stress_delta": 0},
    {"id": "bad", "label": "Bad", "score": 0, "stress_delta": 1},
]

FORCED_OPTIONS = [
    {"id": "good", "label": "Good", "score": 10, "stress_delta": 0},
    {"id": "forced", "label": "Forced", "score": -5, "stress_delta": 0},
    {"id": "bad", "label": "Bad", "score": 0, "stress_delta": 1},
]


def _chain_config(exercise_id: int, templates: list[DecisionTemplate]) -> EngineConfig:
    mode = SimpleCollaborativeMode(
        decision_sequence=[t.id for t in templates],
        base_decision_time_ms=60_000,
    )
    return EngineConfig(
        exercise_id=exercise_id,
        title="Chain Test",
        decision_templates=templates,
        game_mode=mode,
        context=ScenarioContext(title="Chain"),
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


def _make_engine(exercise_id: int, templates: list[DecisionTemplate]) -> None:
    config = _chain_config(exercise_id, templates)
    engine = session_store.create(config)
    with patch("engine.time_manager._now_ms", return_value=0.0):
        engine._time.start()
        engine._time._paused = False
    engine._phase = engine._phase.__class__("running")


def _open_first_decision(exercise_id: int, template: DecisionTemplate) -> None:
    engine = session_store.get(exercise_id)
    engine._decisions.open_decision(
        id=template.id,
        event_id=None,
        issue_id=template.issue_id,
        title=template.title,
        description=template.description,
        question_type=template.question_type,
        options=template.options,
        completion_mode=template.completion_mode,
        target_roles=template.target_roles,
        timeout_ms=0,
        current_pt_ms=0.0,
    )


async def _create_exercise(client: AsyncClient) -> int:
    resp = await client.post("/api/exercises", json={"title": "Chain Ex"})
    assert resp.status_code == 201
    return resp.json()["id"]


def _template(tid: str, opts: list[dict] | None = None) -> DecisionTemplate:
    return DecisionTemplate(
        id=tid,
        title=f"Decision {tid}",
        description="",
        issue_id="iss-1",
        question_type="single_choice",
        options=opts or OPTIONS,
        completion_mode="gm_closes",
    )


# ── Decision chaining ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_close_decision_opens_next_in_chain(
    client: AsyncClient,
) -> None:
    eid = await _create_exercise(client)
    t1, t2 = _template("d1"), _template("d2")
    _make_engine(eid, [t1, t2])
    _open_first_decision(eid, t1)

    resp = await client.post(
        f"/api/exercises/{eid}/engine/decisions/d1/close",
        json={"selected_option_ids": ["good"]},
    )
    assert resp.status_code == 200

    # D2 should now be open
    decisions = await client.get(f"/api/exercises/{eid}/engine/decisions")
    assert decisions.status_code == 200
    open_ids = [d["id"] for d in decisions.json()]
    assert "d2" in open_ids


@pytest.mark.asyncio
async def test_close_last_decision_no_more_open(
    client: AsyncClient,
) -> None:
    eid = await _create_exercise(client)
    t1 = _template("d1")
    _make_engine(eid, [t1])
    _open_first_decision(eid, t1)

    await client.post(
        f"/api/exercises/{eid}/engine/decisions/d1/close",
        json={"selected_option_ids": ["good"]},
    )
    decisions = await client.get(f"/api/exercises/{eid}/engine/decisions")
    assert len(decisions.json()) == 0


# ── Scoring and stress ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_wrong_answer_increases_stress(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    t1, t2 = _template("d1"), _template("d2")
    _make_engine(eid, [t1, t2])
    _open_first_decision(eid, t1)

    # Select bad option (score=0, stress_delta=1) — stress increases
    await client.post(
        f"/api/exercises/{eid}/engine/decisions/d1/close",
        json={"selected_option_ids": ["bad"]},
    )

    engine = session_store.get(eid)
    mode = engine.game_mode
    assert mode.total_score == 0.0
    assert mode.stress == 1


@pytest.mark.asyncio
async def test_correct_answer_no_stress(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    t1, t2 = _template("d1"), _template("d2")
    _make_engine(eid, [t1, t2])
    _open_first_decision(eid, t1)

    await client.post(
        f"/api/exercises/{eid}/engine/decisions/d1/close",
        json={"selected_option_ids": ["good"]},
    )

    engine = session_store.get(eid)
    assert engine.game_mode.total_score == 10.0
    assert engine.game_mode.stress == 0


# ── Forced card enforcement ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_forced_card_auto_applied(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    t1 = DecisionTemplate(
        id="d1",
        title="Forced",
        description="",
        issue_id="iss-1",
        question_type="single_choice",
        options=FORCED_OPTIONS,
        completion_mode="gm_closes",
        forced_option_ids=["forced"],
    )
    _make_engine(eid, [t1])
    _open_first_decision(eid, t1)

    # Select "good" only — "forced" should be auto-added
    await client.post(
        f"/api/exercises/{eid}/engine/decisions/d1/close",
        json={"selected_option_ids": ["good"]},
    )

    engine = session_store.get(eid)
    # Score should include forced card: 10 + (-5) = 5
    assert engine.game_mode.total_score == 5.0


# ── max_selections validation ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_close_exceeding_max_selections_returns_400(
    client: AsyncClient,
) -> None:
    eid = await _create_exercise(client)
    t1 = DecisionTemplate(
        id="d1",
        title="Limited",
        description="",
        issue_id="iss-1",
        question_type="multi_choice",
        options=OPTIONS,
        completion_mode="gm_closes",
        max_selections=1,
    )
    _make_engine(eid, [t1])
    _open_first_decision(eid, t1)

    resp = await client.post(
        f"/api/exercises/{eid}/engine/decisions/d1/close",
        json={"selected_option_ids": ["good", "bad"]},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_close_within_max_selections_succeeds(
    client: AsyncClient,
) -> None:
    eid = await _create_exercise(client)
    t1 = DecisionTemplate(
        id="d1",
        title="Limited",
        description="",
        issue_id="iss-1",
        question_type="multi_choice",
        options=OPTIONS,
        completion_mode="gm_closes",
        max_selections=2,
    )
    _make_engine(eid, [t1])
    _open_first_decision(eid, t1)

    resp = await client.post(
        f"/api/exercises/{eid}/engine/decisions/d1/close",
        json={"selected_option_ids": ["good", "bad"]},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_close_with_no_max_selections_allows_all(
    client: AsyncClient,
) -> None:
    eid = await _create_exercise(client)
    t1 = _template("d1")  # max_selections=None by default
    _make_engine(eid, [t1])
    _open_first_decision(eid, t1)

    resp = await client.post(
        f"/api/exercises/{eid}/engine/decisions/d1/close",
        json={"selected_option_ids": ["good", "bad"]},
    )
    assert resp.status_code == 200


# ── Close nonexistent / already-closed ───────────────────────────────────


@pytest.mark.asyncio
async def test_close_nonexistent_decision_404(
    client: AsyncClient,
) -> None:
    eid = await _create_exercise(client)
    _make_engine(eid, [_template("d1")])
    resp = await client.post(
        f"/api/exercises/{eid}/engine/decisions/nope/close",
        json={"selected_option_ids": []},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_close_already_closed_decision_404(
    client: AsyncClient,
) -> None:
    eid = await _create_exercise(client)
    t1 = _template("d1")
    _make_engine(eid, [t1])
    _open_first_decision(eid, t1)

    await client.post(
        f"/api/exercises/{eid}/engine/decisions/d1/close",
        json={"selected_option_ids": ["good"]},
    )
    resp = await client.post(
        f"/api/exercises/{eid}/engine/decisions/d1/close",
        json={"selected_option_ids": ["good"]},
    )
    assert resp.status_code == 404
