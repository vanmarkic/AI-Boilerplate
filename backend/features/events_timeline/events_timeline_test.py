from httpx import AsyncClient


class TestCreateEventsTimeline:
    async def test_creates_with_valid_data(self, client: AsyncClient) -> None:
        response = await client.post("/api/events_timelines", json={})
        assert response.status_code == 201  # FAILING: implement endpoint

    async def test_returns_404_for_nonexistent(self, client: AsyncClient) -> None:
        response = await client.get("/api/events_timelines/999")
        assert response.status_code == 404
