import pytest
from httpx import AsyncClient

VALID_CONTENT = {
    "roles": [
        {"id": "co", "label": "CO", "player_type": "decision_maker"},
    ],
}


async def _create(client: AsyncClient) -> dict:
    resp = await client.post(
        "/api/scenarios",
        json={"title": "Original", "content": VALID_CONTENT},
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.mark.asyncio
async def test_clone_scenario(client: AsyncClient) -> None:
    original = await _create(client)
    resp = await client.post(f"/api/scenarios/{original['id']}/clone")
    assert resp.status_code == 201
    clone = resp.json()
    assert clone["title"] == "Original (Copy)"
    assert clone["id"] != original["id"]
    assert clone["version"] == 1
    assert clone["content"]["roles"] == VALID_CONTENT["roles"]


@pytest.mark.asyncio
async def test_clone_scenario_not_found(client: AsyncClient) -> None:
    resp = await client.post("/api/scenarios/9999/clone")
    assert resp.status_code == 404
