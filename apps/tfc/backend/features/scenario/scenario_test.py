import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_scenario(client: AsyncClient) -> None:
    response = await client.post(
        "/api/scenarios",
        json={
            "title": "Alpha Scenario",
            "description": "Test scenario",
            "content": {"phases": [], "injects": []},
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Alpha Scenario"
    assert data["version"] == 1
    assert data["content"] == {"phases": [], "injects": []}


@pytest.mark.asyncio
async def test_get_scenario(client: AsyncClient) -> None:
    create_resp = await client.post(
        "/api/scenarios",
        json={"title": "Bravo Scenario"},
    )
    scenario_id = create_resp.json()["id"]

    response = await client.get(f"/api/scenarios/{scenario_id}")
    assert response.status_code == 200
    assert response.json()["title"] == "Bravo Scenario"


@pytest.mark.asyncio
async def test_get_scenario_not_found(client: AsyncClient) -> None:
    response = await client.get("/api/scenarios/9999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_scenarios(client: AsyncClient) -> None:
    await client.post("/api/scenarios", json={"title": "Sc 1"})
    await client.post("/api/scenarios", json={"title": "Sc 2"})

    response = await client.get("/api/scenarios")
    assert response.status_code == 200
    assert len(response.json()) >= 2


@pytest.mark.asyncio
async def test_update_scenario(client: AsyncClient) -> None:
    create_resp = await client.post(
        "/api/scenarios", json={"title": "Original"},
    )
    scenario_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/scenarios/{scenario_id}",
        json={"title": "Updated", "version": 2},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Updated"
    assert response.json()["version"] == 2


@pytest.mark.asyncio
async def test_delete_scenario(client: AsyncClient) -> None:
    create_resp = await client.post(
        "/api/scenarios", json={"title": "To Delete"},
    )
    scenario_id = create_resp.json()["id"]

    response = await client.delete(f"/api/scenarios/{scenario_id}")
    assert response.status_code == 204

    get_resp = await client.get(f"/api/scenarios/{scenario_id}")
    assert get_resp.status_code == 404
