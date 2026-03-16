import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.fixture
async def client() -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestCanaryPing:
    async def test_ping_returns_marker(self, client: AsyncClient) -> None:
        response = await client.get("/api/canary/ping")
        assert response.status_code == 200
        data = response.json()
        assert data["marker"] == "canary-tier2-backend-present"
