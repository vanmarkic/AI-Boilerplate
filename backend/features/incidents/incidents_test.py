from datetime import datetime
from httpx import AsyncClient


class TestCreateIncident:
    async def test_creates_with_valid_data(self, client: AsyncClient) -> None:
        payload = {
            "title": "Database Outage",
            "description": "PostgreSQL service went down",
            "severity": "critical",
            "started_at": datetime.now().isoformat(),
        }
        response = await client.post("/api/incidents", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Database Outage"
        assert data["status"] == "ongoing"

    async def test_returns_400_for_invalid_severity(self, client: AsyncClient) -> None:
        payload = {
            "title": "Test Incident",
            "description": "Test",
            "severity": "invalid",
            "started_at": datetime.now().isoformat(),
        }
        response = await client.post("/api/incidents", json=payload)
        assert response.status_code == 422


class TestGetIncident:
    async def test_returns_404_for_nonexistent(self, client: AsyncClient) -> None:
        response = await client.get("/api/incidents/999")
        assert response.status_code == 404

    async def test_returns_incident_with_valid_id(self, client: AsyncClient) -> None:
        # First create an incident
        payload = {
            "title": "Test Incident",
            "description": "Test",
            "severity": "high",
            "started_at": datetime.now().isoformat(),
        }
        create_response = await client.post("/api/incidents", json=payload)
        incident_id = create_response.json()["id"]

        # Then retrieve it
        response = await client.get(f"/api/incidents/{incident_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == incident_id


class TestListIncidents:
    async def test_lists_incidents(self, client: AsyncClient) -> None:
        response = await client.get("/api/incidents")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_filters_by_severity(self, client: AsyncClient) -> None:
        response = await client.get("/api/incidents?severity=critical")
        assert response.status_code == 200
        incidents = response.json()
        for incident in incidents:
            assert incident["severity"] == "critical"


class TestHistogram:
    async def test_returns_histogram_data(self, client: AsyncClient) -> None:
        response = await client.get("/api/incidents/timeline/histogram")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
