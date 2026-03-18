import pytest
from httpx import AsyncClient

VALID_CONTENT = {
    "roles": [
        {"id": "co", "label": "CO", "player_type": "decision_maker"},
    ],
}


async def _create(client: AsyncClient, **overrides: object) -> dict:
    """Create a scenario with defaults, return response JSON."""
    payload: dict = {"title": "Test Scenario", "content": VALID_CONTENT}
    payload.update(overrides)
    resp = await client.post("/api/scenarios", json=payload)
    assert resp.status_code == 201
    return resp.json()


@pytest.mark.asyncio
async def test_create_scenario(client: AsyncClient) -> None:
    data = await _create(client, title="Alpha Scenario", description="Test scenario")
    assert data["title"] == "Alpha Scenario"
    assert data["version"] == 1
    assert data["content"]["roles"] == VALID_CONTENT["roles"]


@pytest.mark.asyncio
async def test_create_scenario_without_content_rejected(client: AsyncClient) -> None:
    resp = await client.post("/api/scenarios", json={"title": "No Content"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_scenario(client: AsyncClient) -> None:
    created = await _create(client, title="Bravo Scenario")
    response = await client.get(f"/api/scenarios/{created['id']}")
    assert response.status_code == 200
    assert response.json()["title"] == "Bravo Scenario"


@pytest.mark.asyncio
async def test_get_scenario_not_found(client: AsyncClient) -> None:
    response = await client.get("/api/scenarios/9999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_scenarios(client: AsyncClient) -> None:
    await _create(client, title="Sc 1")
    await _create(client, title="Sc 2")

    response = await client.get("/api/scenarios")
    assert response.status_code == 200
    assert len(response.json()) >= 2


@pytest.mark.asyncio
async def test_list_scenarios_by_domain(client: AsyncClient) -> None:
    await _create(client, title="Domain Sc", domain_id=42)
    await _create(client, title="Other Sc", domain_id=99)

    response = await client.get("/api/scenarios?domain_id=42")
    assert response.status_code == 200
    assert all(s["domain_id"] == 42 for s in response.json())


@pytest.mark.asyncio
async def test_update_scenario(client: AsyncClient) -> None:
    created = await _create(client, title="Original")

    response = await client.put(
        f"/api/scenarios/{created['id']}",
        json={"title": "Updated", "version": 2},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Updated"
    assert response.json()["version"] == 2


@pytest.mark.asyncio
async def test_delete_scenario(client: AsyncClient) -> None:
    created = await _create(client, title="To Delete")

    response = await client.delete(f"/api/scenarios/{created['id']}")
    assert response.status_code == 204

    get_resp = await client.get(f"/api/scenarios/{created['id']}")
    assert get_resp.status_code == 404
