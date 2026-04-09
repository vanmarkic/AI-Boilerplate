import pytest
from httpx import AsyncClient

VALID_PAYLOAD = {
    "slug": "test-domain",
    "name": "Test Domain",
    "description": "A test domain config",
    "terminology": {
        "event": "Incident",
        "issue": "Threat",
        "player": "Analyst",
        "trainer": "Director",
        "exercise": "Exercise",
        "scenario": "Scenario",
        "decision": "Action",
    },
    "theme": {
        "colorPrimary": "#000000",
        "colorSecondary": "#111111",
        "colorBackground": "#ffffff",
        "colorForeground": "#1e293b",
        "fontFamily": "system-ui",
        "fontFamilyMono": "monospace",
        "density": "comfortable",
    },
    "roles": [
        {"id": "analyst", "label": "Analyst", "description": "SOC analyst"},
    ],
    "severity_levels": [
        {"id": "low", "label": "Low", "color": "#22c55e", "order": 1},
        {"id": "high", "label": "High", "color": "#ef4444", "order": 2},
    ],
}


async def _create(client: AsyncClient, **overrides: object) -> dict:
    payload = {**VALID_PAYLOAD, **overrides}
    resp = await client.post("/api/domain-configs", json=payload)
    assert resp.status_code == 201
    return resp.json()


@pytest.mark.asyncio
async def test_create_domain_config(client: AsyncClient) -> None:
    data = await _create(client)
    assert data["slug"] == "test-domain"
    assert data["name"] == "Test Domain"
    assert data["terminology"]["event"] == "Incident"
    assert len(data["roles"]) == 1
    assert len(data["severity_levels"]) == 2
    assert data["id"] is not None


@pytest.mark.asyncio
async def test_create_duplicate_slug_returns_409(client: AsyncClient) -> None:
    await _create(client, slug="unique-slug")
    resp = await client.post(
        "/api/domain-configs",
        json={**VALID_PAYLOAD, "slug": "unique-slug"},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_get_domain_config_by_id(client: AsyncClient) -> None:
    created = await _create(client)
    resp = await client.get(f"/api/domain-configs/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["slug"] == "test-domain"


@pytest.mark.asyncio
async def test_get_domain_config_not_found(client: AsyncClient) -> None:
    resp = await client.get("/api/domain-configs/9999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_domain_config_by_slug(client: AsyncClient) -> None:
    await _create(client, slug="cyber")
    resp = await client.get("/api/domain-configs/by-slug/cyber")
    assert resp.status_code == 200
    assert resp.json()["slug"] == "cyber"


@pytest.mark.asyncio
async def test_get_by_slug_not_found(client: AsyncClient) -> None:
    resp = await client.get("/api/domain-configs/by-slug/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_domain_configs(client: AsyncClient) -> None:
    await _create(client, slug="dc-1")
    await _create(client, slug="dc-2")
    resp = await client.get("/api/domain-configs")
    assert resp.status_code == 200
    slugs = [d["slug"] for d in resp.json()]
    assert "dc-1" in slugs
    assert "dc-2" in slugs


@pytest.mark.asyncio
async def test_update_domain_config(client: AsyncClient) -> None:
    created = await _create(client)
    resp = await client.put(
        f"/api/domain-configs/{created['id']}",
        json={"name": "Updated Name"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Name"
    assert resp.json()["slug"] == "test-domain"


@pytest.mark.asyncio
async def test_update_terminology(client: AsyncClient) -> None:
    created = await _create(client)
    new_terminology = {
        "event": "Case",
        "issue": "Complication",
        "player": "Clinician",
        "trainer": "Lead",
        "exercise": "Simulation",
        "scenario": "Clinical Scenario",
        "decision": "Clinical Decision",
    }
    resp = await client.put(
        f"/api/domain-configs/{created['id']}",
        json={"terminology": new_terminology},
    )
    assert resp.status_code == 200
    assert resp.json()["terminology"]["event"] == "Case"


@pytest.mark.asyncio
async def test_update_nonexistent_returns_404(client: AsyncClient) -> None:
    resp = await client.put(
        "/api/domain-configs/9999",
        json={"name": "Ghost"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_domain_config(client: AsyncClient) -> None:
    created = await _create(client)
    resp = await client.delete(f"/api/domain-configs/{created['id']}")
    assert resp.status_code == 204
    get_resp = await client.get(f"/api/domain-configs/{created['id']}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_returns_404(client: AsyncClient) -> None:
    resp = await client.delete("/api/domain-configs/9999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_invalid_payload_returns_422(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/domain-configs",
        json={"slug": "bad", "name": "Bad"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_terminology_roundtrip(client: AsyncClient) -> None:
    """Terminology stored in DB matches what was sent exactly."""
    created = await _create(client, slug="roundtrip")
    fetched = await client.get(f"/api/domain-configs/{created['id']}")
    assert fetched.json()["terminology"] == VALID_PAYLOAD["terminology"]


@pytest.mark.asyncio
async def test_roles_roundtrip(client: AsyncClient) -> None:
    """Roles array stored in DB matches what was sent exactly."""
    created = await _create(client, slug="roles-rt")
    fetched = await client.get(f"/api/domain-configs/{created['id']}")
    assert fetched.json()["roles"] == VALID_PAYLOAD["roles"]


@pytest.mark.asyncio
async def test_severity_levels_roundtrip(client: AsyncClient) -> None:
    """Severity levels array stored in DB matches what was sent."""
    created = await _create(client, slug="sev-rt")
    fetched = await client.get(f"/api/domain-configs/{created['id']}")
    assert fetched.json()["severity_levels"] == VALID_PAYLOAD["severity_levels"]


@pytest.mark.asyncio
async def test_create_domain_config_with_catalogs(client: AsyncClient) -> None:
    """DomainConfig with systems, warfare_domains, and blue_card_catalog."""
    payload = {
        **VALID_PAYLOAD,
        "slug": "catalogs",
        "systems": [
            {"id": "nav-radar", "label": "NAV RADAR", "category": "system"},
        ],
        "warfare_domains": [
            {"id": "aaw", "label": "AAW"},
        ],
        "blue_card_catalog": [
            {"id": "SWB01", "title": "Continue Mission"},
        ],
    }
    resp = await client.post("/api/domain-configs", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["systems"]) == 1
    assert len(data["warfare_domains"]) == 1
    assert len(data["blue_card_catalog"]) == 1


@pytest.mark.asyncio
async def test_update_domain_config_catalogs(client: AsyncClient) -> None:
    """Update warfare_domains and blue_card_catalog."""
    resp = await client.post("/api/domain-configs", json=VALID_PAYLOAD)
    config_id = resp.json()["id"]
    update = {
        "warfare_domains": [{"id": "cyber", "label": "CYBER"}],
        "blue_card_catalog": [{"id": "SWB01", "title": "Continue Mission"}],
    }
    resp = await client.put(f"/api/domain-configs/{config_id}", json=update)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["warfare_domains"]) == 1
    assert len(data["blue_card_catalog"]) == 1
