from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from core.sse_router import (
    _allowed_channels,
    patch_channel_enum,
    register_channel,
    router,
)


@pytest.fixture(autouse=True)
def _clean_channels() -> None:
    """Reset the channel registry between tests."""
    _allowed_channels.clear()
    yield
    _allowed_channels.clear()


@pytest.fixture
def test_app() -> FastAPI:
    """Minimal app with just the SSE router."""
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
async def client(test_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestListChannels:
    async def test_returns_empty_when_no_channels(
        self, client: AsyncClient,
    ) -> None:
        response = await client.get("/api/events")
        assert response.status_code == 200
        assert response.json() == {}

    async def test_returns_registered_channels(
        self, client: AsyncClient,
    ) -> None:
        register_channel("comments", description="New comments")
        register_channel("orders", description="Order updates")

        response = await client.get("/api/events")
        assert response.status_code == 200
        data = response.json()
        assert data["comments"] == "New comments"
        assert data["orders"] == "Order updates"


class TestSubscribeEndpoint:
    async def test_unknown_channel_returns_404(
        self, client: AsyncClient,
    ) -> None:
        response = await client.get("/api/events/nonexistent")
        assert response.status_code == 404

    @patch("core.sse_router.event_bus")
    async def test_registered_channel_streams_sse(
        self, mock_bus: AsyncMock, client: AsyncClient,
    ) -> None:
        register_channel("comments")

        async def fake_subscribe(channel: str) -> AsyncGenerator[str, None]:  # type: ignore[no-untyped-def]
            yield '{"id": 1}'

        mock_bus.subscribe = fake_subscribe

        response = await client.get("/api/events/comments")

        assert response.headers["content-type"].startswith("text/event-stream")
        assert 'data: {"id": 1}' in response.text


class TestPatchChannelEnum:
    def test_injects_enum_into_openapi_schema(self) -> None:
        register_channel("comments", description="New comments")
        register_channel("orders", description="Order updates")

        schema = {
            "paths": {
                "/api/events/{channel}": {
                    "get": {
                        "parameters": [
                            {"name": "channel", "in": "path", "schema": {"type": "string"}},
                        ],
                    },
                },
            },
        }

        result = patch_channel_enum(schema)

        param = result["paths"]["/api/events/{channel}"]["get"]["parameters"][0]
        assert param["schema"]["enum"] == ["comments", "orders"]

    def test_empty_channels_produces_empty_enum(self) -> None:
        schema = {
            "paths": {
                "/api/events/{channel}": {
                    "get": {
                        "parameters": [
                            {"name": "channel", "in": "path", "schema": {"type": "string"}},
                        ],
                    },
                },
            },
        }

        result = patch_channel_enum(schema)

        param = result["paths"]["/api/events/{channel}"]["get"]["parameters"][0]
        assert param["schema"]["enum"] == []

    def test_no_channel_path_is_noop(self) -> None:
        schema = {"paths": {"/api/health": {"get": {}}}}
        result = patch_channel_enum(schema)
        assert result == schema
