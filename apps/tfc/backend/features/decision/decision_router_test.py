"""HTTP API tests for decision router endpoints."""

import pytest
from httpx import AsyncClient


async def _create_exercise(client: AsyncClient) -> int:
    resp = await client.post("/api/exercises", json={"title": "Decision Test Ex"})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_decision(
    client: AsyncClient,
    **overrides: object,
) -> dict:
    if "exercise_id" not in overrides:
        overrides["exercise_id"] = await _create_exercise(client)
    payload = {
        "title": "Test Decision",
        "description": "Choose wisely",
        "exercise_id": overrides.pop("exercise_id"),
        "issue_id": "issue-1",
        "question_type": "single_choice",
        "options": [
            {"id": "a", "label": "Yes", "score": 10},
            {"id": "b", "label": "No", "score": 0},
        ],
        "completion_mode": "first_response",
        **overrides,
    }
    resp = await client.post("/api/decisions", json=payload)
    assert resp.status_code == 201
    return resp.json()


@pytest.mark.asyncio
async def test_create_decision(client: AsyncClient) -> None:
    data = await _create_decision(client)
    assert data["title"] == "Test Decision"
    assert data["status"] == "open"
    assert data["question_type"] == "single_choice"
    assert data["id"] is not None
    assert data["responses_count"] == 0


@pytest.mark.asyncio
async def test_create_decision_invalid_question_type(
    client: AsyncClient,
) -> None:
    eid = await _create_exercise(client)
    resp = await client.post(
        "/api/decisions",
        json={
            "title": "Bad",
            "exercise_id": eid,
            "issue_id": "x",
            "question_type": "invalid_type",
            "completion_mode": "first_response",
        },
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_decision_missing_fields_422(
    client: AsyncClient,
) -> None:
    resp = await client.post("/api/decisions", json={"title": "Incomplete"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_decisions(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    await _create_decision(client, exercise_id=eid, title="D1")
    await _create_decision(client, exercise_id=eid, title="D2")

    resp = await client.get(f"/api/decisions?exercise_id={eid}")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_list_decisions_filter_by_status(
    client: AsyncClient,
) -> None:
    eid = await _create_exercise(client)
    d = await _create_decision(client, exercise_id=eid)
    await client.post(f"/api/decisions/{d['id']}/close")

    await _create_decision(client, exercise_id=eid, title="Still Open", completion_mode="gm_closes")

    resp = await client.get(f"/api/decisions?exercise_id={eid}&status=open")
    assert resp.status_code == 200
    items = resp.json()
    assert all(i["status"] == "open" for i in items)


@pytest.mark.asyncio
async def test_get_decision(client: AsyncClient) -> None:
    created = await _create_decision(client)
    resp = await client.get(f"/api/decisions/{created['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Test Decision"
    assert "responses" in data  # detail response includes responses list


@pytest.mark.asyncio
async def test_get_decision_not_found(client: AsyncClient) -> None:
    resp = await client.get("/api/decisions/9999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_submit_response(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    d = await _create_decision(
        client,
        exercise_id=eid,
        completion_mode="gm_closes",
    )
    resp = await client.post(
        f"/api/decisions/{d['id']}/responses",
        json={
            "participant_id": "user-1",
            "participant_name": "Alice",
            "selected_options": ["a"],
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["participant_name"] == "Alice"
    assert data["score"] == 10.0


@pytest.mark.asyncio
async def test_submit_response_closed_decision(
    client: AsyncClient,
) -> None:
    d = await _create_decision(client)
    await client.post(f"/api/decisions/{d['id']}/close")

    resp = await client.post(
        f"/api/decisions/{d['id']}/responses",
        json={
            "participant_id": "user-2",
            "participant_name": "Bob",
            "selected_options": ["a"],
        },
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_close_decision(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    d = await _create_decision(
        client,
        exercise_id=eid,
        completion_mode="gm_closes",
    )
    resp = await client.post(f"/api/decisions/{d['id']}/close")
    assert resp.status_code == 200
    assert resp.json()["status"] == "closed"
