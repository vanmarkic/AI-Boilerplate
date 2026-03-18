"""Server-Sent Events bus backed by PostgreSQL LISTEN/NOTIFY.

Design: Singleton event bus that maintains ONE asyncpg connection dedicated
to LISTEN. When a channel is first subscribed, it issues LISTEN on that
channel. Fan-out to multiple async clients is done via per-channel sets of
asyncio.Queue (Observer pattern).

Usage:
    # Publish (from any service that has a DB session):
    await event_bus.publish("comments", {"id": 1, "text": "hello"})

    # Subscribe (from an SSE endpoint):
    async for payload in event_bus.subscribe("comments"):
        yield f"data: {payload}\\n\\n"
"""

import asyncio
import json
import logging
from collections import defaultdict
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import asyncpg

from core.config import settings

logger = logging.getLogger(__name__)

# Max queued events per subscriber before oldest are dropped.
_SUBSCRIBER_QUEUE_MAX = 256


def _pg_dsn() -> str:
    """Convert SQLAlchemy DSN to plain postgres:// for asyncpg."""
    return settings.database_url.replace("+asyncpg", "")


class EventBus:
    """Manages pg LISTEN/NOTIFY and in-memory fan-out to SSE subscribers."""

    def __init__(self) -> None:
        self._conn: asyncpg.Connection | None = None
        self._subscribers: dict[str, set[asyncio.Queue[str]]] = defaultdict(set)
        self._listened_channels: set[str] = set()
        self._lock = asyncio.Lock()

    # -- lifecycle ------------------------------------------------------------

    async def connect(self) -> None:
        """Open a dedicated asyncpg connection for LISTEN."""
        self._conn = await asyncpg.connect(dsn=_pg_dsn())
        logger.info("EventBus: LISTEN connection established")

    async def disconnect(self) -> None:
        """Close the LISTEN connection and drain subscribers."""
        if self._conn and not self._conn.is_closed():
            await self._conn.close()
        self._subscribers.clear()
        self._listened_channels.clear()
        logger.info("EventBus: disconnected")

    # -- publish --------------------------------------------------------------

    async def publish(self, channel: str, payload: dict[str, Any]) -> None:
        """Send a NOTIFY on *channel* with JSON-encoded *payload*.

        Uses a short-lived connection so it does not block the LISTEN
        connection and works from any async context.
        """
        raw = json.dumps(payload, default=str)
        conn: asyncpg.Connection = await asyncpg.connect(dsn=_pg_dsn())
        try:
            await conn.execute("SELECT pg_notify($1, $2)", channel, raw)
        finally:
            await conn.close()

    # -- subscribe / fan-out --------------------------------------------------

    async def _ensure_listen(self, channel: str) -> None:
        """Issue LISTEN once per channel (idempotent)."""
        async with self._lock:
            if channel in self._listened_channels:
                return
            if self._conn is None:
                raise RuntimeError("EventBus not connected")

            def _on_notification(
                conn: asyncpg.Connection,
                pid: int,
                ch: str,
                payload: str,
            ) -> None:
                for queue in self._subscribers.get(ch, set()):
                    try:
                        queue.put_nowait(payload)
                    except asyncio.QueueFull:
                        # Drop oldest to prevent slow consumers from OOM.
                        try:
                            queue.get_nowait()
                        except asyncio.QueueEmpty:
                            pass
                        queue.put_nowait(payload)

            await self._conn.add_listener(channel, _on_notification)
            self._listened_channels.add(channel)
            logger.info("EventBus: LISTEN %s", channel)

    @asynccontextmanager
    async def _register_queue(
        self,
        channel: str,
    ) -> AsyncGenerator[asyncio.Queue[str], None]:
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=_SUBSCRIBER_QUEUE_MAX)
        self._subscribers[channel].add(queue)
        try:
            yield queue
        finally:
            self._subscribers[channel].discard(queue)
            if not self._subscribers[channel]:
                self._subscribers.pop(channel, None)

    async def subscribe(self, channel: str) -> AsyncGenerator[str, None]:
        """Yield JSON payloads as they arrive on *channel*.

        The caller is responsible for detecting client disconnect and
        breaking out of the loop.
        """
        await self._ensure_listen(channel)
        async with self._register_queue(channel) as queue:
            while True:
                payload = await queue.get()
                yield payload


# Module-level singleton — imported by other modules.
event_bus = EventBus()
