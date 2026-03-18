from unittest.mock import AsyncMock, patch

import pytest
from pydantic import BaseModel

from core.broadcast import broadcast


class _FakeResponse(BaseModel):
    id: int
    text: str


class TestBroadcastStaticChannel:
    @patch("core.broadcast.event_bus.publish", new_callable=AsyncMock)
    async def test_publishes_pydantic_model_as_dict(
        self,
        mock_publish: AsyncMock,
    ) -> None:
        @broadcast("comments")
        async def create() -> _FakeResponse:
            return _FakeResponse(id=1, text="hello")

        await create()

        mock_publish.assert_awaited_once_with("comments", {"id": 1, "text": "hello"})

    @patch("core.broadcast.event_bus.publish", new_callable=AsyncMock)
    async def test_publishes_dict_directly(
        self,
        mock_publish: AsyncMock,
    ) -> None:
        @broadcast("events")
        async def action() -> dict:
            return {"key": "value"}

        await action()

        mock_publish.assert_awaited_once_with("events", {"key": "value"})

    @patch("core.broadcast.event_bus.publish", new_callable=AsyncMock)
    async def test_passes_through_return_value(
        self,
        mock_publish: AsyncMock,
    ) -> None:
        expected = _FakeResponse(id=5, text="kept")

        @broadcast("ch")
        async def create() -> _FakeResponse:
            return expected

        result = await create()

        assert result is expected

    @patch("core.broadcast.event_bus.publish", new_callable=AsyncMock)
    async def test_swallows_publish_errors(
        self,
        mock_publish: AsyncMock,
    ) -> None:
        mock_publish.side_effect = RuntimeError("pg down")

        @broadcast("ch")
        async def create() -> dict:
            return {"id": 1}

        result = await create()

        assert result == {"id": 1}

    @patch("core.broadcast.event_bus.publish", new_callable=AsyncMock)
    async def test_wraps_non_dict_non_model_in_data_key(
        self,
        mock_publish: AsyncMock,
    ) -> None:
        @broadcast("ch")
        async def create() -> str:
            return "plain"

        await create()

        mock_publish.assert_awaited_once_with("ch", {"data": "plain"})


class TestBroadcastDynamicChannel:
    @patch("core.broadcast.event_bus.publish", new_callable=AsyncMock)
    async def test_dynamic_channel_from_kwarg(
        self,
        mock_publish: AsyncMock,
    ) -> None:
        @broadcast(channel_kwarg="room_id", prefix="room")
        async def send(room_id: int) -> dict:
            return {"msg": "hi"}

        await send(room_id=42)

        mock_publish.assert_awaited_once_with("room:42", {"msg": "hi"})

    @patch("core.broadcast.event_bus.publish", new_callable=AsyncMock)
    async def test_missing_kwarg_skips_publish(
        self,
        mock_publish: AsyncMock,
    ) -> None:
        @broadcast(channel_kwarg="room_id", prefix="room")
        async def send() -> dict:
            return {"msg": "hi"}

        result = await send()

        assert result == {"msg": "hi"}
        mock_publish.assert_not_awaited()


class TestBroadcastValidation:
    def test_raises_if_no_channel_or_kwarg(self) -> None:
        with pytest.raises(ValueError, match="Provide either"):

            @broadcast()
            async def noop() -> None:
                pass
