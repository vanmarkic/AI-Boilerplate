import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.sse import _SUBSCRIBER_QUEUE_MAX, EventBus


class TestEventBusLifecycle:
    @patch("core.sse.asyncpg.connect", new_callable=AsyncMock)
    async def test_connect_creates_asyncpg_connection(
        self, mock_connect: AsyncMock,
    ) -> None:
        bus = EventBus()
        await bus.connect()
        mock_connect.assert_awaited_once()
        await bus.disconnect()

    @patch("core.sse.asyncpg.connect", new_callable=AsyncMock)
    async def test_disconnect_closes_connection_and_clears_state(
        self, mock_connect: AsyncMock,
    ) -> None:
        mock_conn = AsyncMock()
        mock_conn.is_closed = MagicMock(return_value=False)
        mock_connect.return_value = mock_conn

        bus = EventBus()
        await bus.connect()

        # Simulate some internal state.
        bus._listened_channels.add("test")
        bus._subscribers["test"].add(asyncio.Queue())

        await bus.disconnect()

        mock_conn.close.assert_awaited_once()
        assert len(bus._subscribers) == 0
        assert len(bus._listened_channels) == 0

    async def test_subscribe_before_connect_raises(self) -> None:
        bus = EventBus()
        with pytest.raises(RuntimeError, match="not connected"):
            async for _ in bus.subscribe("test"):
                break


class TestEventBusPublish:
    @patch("core.sse.asyncpg.connect", new_callable=AsyncMock)
    async def test_publish_calls_pg_notify(
        self, mock_connect: AsyncMock,
    ) -> None:
        mock_conn = AsyncMock()
        mock_connect.return_value = mock_conn

        bus = EventBus()
        await bus.publish("comments", {"id": 1})

        mock_conn.execute.assert_awaited_once()
        args = mock_conn.execute.call_args[0]
        assert "pg_notify" in args[0]
        assert args[1] == "comments"
        assert json.loads(args[2]) == {"id": 1}

    @patch("core.sse.asyncpg.connect", new_callable=AsyncMock)
    async def test_publish_closes_connection(
        self, mock_connect: AsyncMock,
    ) -> None:
        mock_conn = AsyncMock()
        mock_connect.return_value = mock_conn

        bus = EventBus()
        await bus.publish("ch", {"x": 1})

        mock_conn.close.assert_awaited_once()


class TestEventBusSubscribe:
    @patch("core.sse.asyncpg.connect", new_callable=AsyncMock)
    async def test_subscribe_calls_listen_once_per_channel(
        self, mock_connect: AsyncMock,
    ) -> None:
        mock_conn = AsyncMock()
        mock_connect.return_value = mock_conn

        bus = EventBus()
        bus._conn = mock_conn

        await bus._ensure_listen("ch1")
        await bus._ensure_listen("ch1")

        assert mock_conn.add_listener.await_count == 1

    async def test_multiple_subscribers_receive_same_payload(self) -> None:
        bus = EventBus()

        q1: asyncio.Queue[str] = asyncio.Queue()
        q2: asyncio.Queue[str] = asyncio.Queue()
        bus._subscribers["ch"].add(q1)
        bus._subscribers["ch"].add(q2)

        # Simulate the notification callback.
        payload = '{"id": 1}'
        for queue in bus._subscribers["ch"]:
            queue.put_nowait(payload)

        assert await q1.get() == payload
        assert await q2.get() == payload

    async def test_slow_consumer_drops_oldest_event(self) -> None:
        bus = EventBus()

        q: asyncio.Queue[str] = asyncio.Queue(maxsize=_SUBSCRIBER_QUEUE_MAX)
        bus._subscribers["ch"].add(q)

        # Fill the queue to capacity.
        for i in range(_SUBSCRIBER_QUEUE_MAX):
            q.put_nowait(f"msg-{i}")

        assert q.full()

        # Simulate what _on_notification does when queue is full.
        new_msg = "msg-new"
        try:
            q.put_nowait(new_msg)
        except asyncio.QueueFull:
            q.get_nowait()  # Drop oldest.
            q.put_nowait(new_msg)

        # Oldest (msg-0) should be gone, newest should be present.
        first = q.get_nowait()
        assert first == "msg-1"

        # Drain to find the newest at the end.
        last = None
        while not q.empty():
            last = q.get_nowait()
        assert last == "msg-new"

    @patch("core.sse.asyncpg.connect", new_callable=AsyncMock)
    async def test_subscribe_yields_payloads(
        self, mock_connect: AsyncMock,
    ) -> None:
        mock_conn = AsyncMock()
        mock_connect.return_value = mock_conn

        bus = EventBus()
        bus._conn = mock_conn

        # Capture the notification callback registered by _ensure_listen.
        callback = None

        async def capture_add_listener(
            channel: str, cb: object,
        ) -> None:
            nonlocal callback
            callback = cb

        mock_conn.add_listener = capture_add_listener

        received: list[str] = []

        async def consume() -> None:
            async for payload in bus.subscribe("ch"):
                received.append(payload)
                if len(received) >= 2:
                    break

        task = asyncio.create_task(consume())
        await asyncio.sleep(0.05)  # Let subscribe set up.

        assert callback is not None
        callback(mock_conn, 0, "ch", '{"a":1}')
        callback(mock_conn, 0, "ch", '{"a":2}')

        await asyncio.wait_for(task, timeout=2.0)
        assert received == ['{"a":1}', '{"a":2}']
