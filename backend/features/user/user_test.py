from httpx import AsyncClient


class TestCreateUser:
    async def test_creates_user_with_valid_data(self, client: AsyncClient) -> None:
        response = await client.post("/api/users", json={
            "email": "test@example.com",
            "name": "Test User",
        })
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["name"] == "Test User"
        assert "id" in data
        assert "created_at" in data

    async def test_rejects_duplicate_email(self, client: AsyncClient) -> None:
        await client.post("/api/users", json={
            "email": "dupe@example.com",
            "name": "First",
        })
        response = await client.post("/api/users", json={
            "email": "dupe@example.com",
            "name": "Second",
        })
        assert response.status_code == 409


class TestGetUser:
    async def test_returns_user_by_id(self, client: AsyncClient) -> None:
        create_resp = await client.post("/api/users", json={
            "email": "fetch@example.com",
            "name": "Fetch Me",
        })
        user_id = create_resp.json()["id"]

        response = await client.get(f"/api/users/{user_id}")
        assert response.status_code == 200
        assert response.json()["email"] == "fetch@example.com"

    async def test_returns_404_for_nonexistent(self, client: AsyncClient) -> None:
        response = await client.get("/api/users/99999")
        assert response.status_code == 404
