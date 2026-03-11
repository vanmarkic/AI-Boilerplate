from datetime import datetime

from httpx import AsyncClient
import pytest

from core.auth import CurrentUser
from main import app


@pytest.fixture
def mock_current_user() -> CurrentUser:
    return CurrentUser(id="user-123", email="test@example.com", roles=["user"])


def override_get_current_user(user: CurrentUser):
    from core.auth import get_current_user
    async def _override():
        return user
    return _override


class TestCreateEvent:
    async def test_creates_event_with_valid_data(self, client: AsyncClient, mock_current_user: CurrentUser) -> None:
        from core.auth import get_current_user
        app.dependency_overrides[get_current_user] = lambda: mock_current_user
        try:
            response = await client.post("/api/events", json={
                "timestamp": datetime.now().isoformat(),
                "event_type": "deployment",
                "severity": "info",
                "description": "Production deployment v1.2.3",
                "metadata": {"version": "1.2.3"},
            })
            assert response.status_code == 201
            data = response.json()
            assert data["event_type"] == "deployment"
            assert data["severity"] == "info"
            assert data["created_by"] == "user-123"
            assert "id" in data
            assert "created_at" in data
        finally:
            app.dependency_overrides.clear()

    async def test_rejects_invalid_severity(self, client: AsyncClient, mock_current_user: CurrentUser) -> None:
        from core.auth import get_current_user
        app.dependency_overrides[get_current_user] = lambda: mock_current_user
        try:
            response = await client.post("/api/events", json={
                "timestamp": datetime.now().isoformat(),
                "event_type": "error",
                "severity": "invalid",
                "description": "Some error",
            })
            assert response.status_code == 422
        finally:
            app.dependency_overrides.clear()


class TestGetEvent:
    async def test_returns_event_by_id(self, client: AsyncClient, mock_current_user: CurrentUser) -> None:
        from core.auth import get_current_user
        app.dependency_overrides[get_current_user] = lambda: mock_current_user
        try:
            create_resp = await client.post("/api/events", json={
                "timestamp": datetime.now().isoformat(),
                "event_type": "alert",
                "severity": "critical",
                "description": "CPU usage over 90%",
            })
            event_id = create_resp.json()["id"]

            response = await client.get(f"/api/events/{event_id}")
            assert response.status_code == 200
            assert response.json()["event_type"] == "alert"
        finally:
            app.dependency_overrides.clear()

    async def test_returns_404_for_nonexistent(self, client: AsyncClient) -> None:
        response = await client.get("/api/events/999")
        assert response.status_code == 404
