import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_exercise(client: AsyncClient) -> None:
    response = await client.post(
        "/api/exercises",
        json={"title": "Alpha Exercise", "description": "Test exercise"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Alpha Exercise"
    assert data["phase"] == "setup"
    assert data["time_factor"] == 1.0


@pytest.mark.asyncio
async def test_get_exercise(client: AsyncClient) -> None:
    create_resp = await client.post(
        "/api/exercises",
        json={"title": "Bravo Exercise"},
    )
    exercise_id = create_resp.json()["id"]

    response = await client.get(f"/api/exercises/{exercise_id}")
    assert response.status_code == 200
    assert response.json()["title"] == "Bravo Exercise"


@pytest.mark.asyncio
async def test_get_exercise_not_found(client: AsyncClient) -> None:
    response = await client.get("/api/exercises/9999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_exercises(client: AsyncClient) -> None:
    await client.post("/api/exercises", json={"title": "Ex 1"})
    await client.post("/api/exercises", json={"title": "Ex 2"})

    response = await client.get("/api/exercises")
    assert response.status_code == 200
    assert len(response.json()) >= 2


@pytest.mark.asyncio
async def test_list_exercises_by_phase(client: AsyncClient) -> None:
    await client.post("/api/exercises", json={"title": "Setup Ex"})

    response = await client.get("/api/exercises?phase=setup")
    assert response.status_code == 200
    assert all(e["phase"] == "setup" for e in response.json())


@pytest.mark.asyncio
async def test_update_exercise(client: AsyncClient) -> None:
    create_resp = await client.post(
        "/api/exercises",
        json={"title": "Original"},
    )
    exercise_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/exercises/{exercise_id}",
        json={"title": "Updated"},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Updated"


@pytest.mark.asyncio
async def test_phase_transition_valid(client: AsyncClient) -> None:
    create_resp = await client.post(
        "/api/exercises",
        json={"title": "Phase Test"},
    )
    exercise_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/exercises/{exercise_id}",
        json={"phase": "briefing"},
    )
    assert response.status_code == 200
    assert response.json()["phase"] == "briefing"


@pytest.mark.asyncio
async def test_phase_transition_invalid(client: AsyncClient) -> None:
    create_resp = await client.post(
        "/api/exercises",
        json={"title": "Phase Test"},
    )
    exercise_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/exercises/{exercise_id}",
        json={"phase": "completed"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_classic_exercise_does_not_auto_assign_trainer(
    client: AsyncClient,
) -> None:
    """Creating a classic exercise does NOT auto-join anyone — trainer joins manually."""
    from features.waiting_room.waiting_room_store import waiting_room_store

    waiting_room_store._rooms.clear()

    resp = await client.post(
        "/api/exercises",
        json={"title": "Classic Manual", "game_mode": "classic"},
    )
    assert resp.status_code == 201
    eid = resp.json()["id"]

    participants = waiting_room_store.list_participants(eid)
    assert len(participants) == 0


@pytest.mark.asyncio
async def test_delete_exercise(client: AsyncClient) -> None:
    create_resp = await client.post(
        "/api/exercises",
        json={"title": "To Delete"},
    )
    exercise_id = create_resp.json()["id"]

    response = await client.delete(f"/api/exercises/{exercise_id}")
    assert response.status_code == 204

    get_resp = await client.get(f"/api/exercises/{exercise_id}")
    assert get_resp.status_code == 404
