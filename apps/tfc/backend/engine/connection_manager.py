"""WebSocket connection manager for real-time exercise broadcasts.

Tracks connected clients per exercise_id with their role (gm/player).
Thread-safe by design: asyncio is single-threaded, so no locks needed.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections grouped by exercise_id and role."""

    def __init__(self) -> None:
        self._connections: dict[int, list[tuple[WebSocket, str]]] = {}

    def connect(
        self, exercise_id: int, websocket: WebSocket, role: str
    ) -> None:
        """Register a new WebSocket client for an exercise."""
        if exercise_id not in self._connections:
            self._connections[exercise_id] = []
        self._connections[exercise_id].append((websocket, role))
        logger.info(
            "WS connected: exercise=%d role=%s", exercise_id, role
        )

    def disconnect(self, exercise_id: int, websocket: WebSocket) -> None:
        """Remove a WebSocket client. No-op if not found."""
        conns = self._connections.get(exercise_id)
        if conns is None:
            return
        self._connections[exercise_id] = [
            (ws, r) for ws, r in conns if ws is not websocket
        ]
        if not self._connections[exercise_id]:
            del self._connections[exercise_id]
        logger.info("WS disconnected: exercise=%d", exercise_id)

    async def broadcast(
        self, exercise_id: int, message: dict[str, Any]
    ) -> None:
        """Send a JSON message to all clients of an exercise."""
        conns = self._connections.get(exercise_id)
        if not conns:
            return
        text = json.dumps(message)
        for ws, _role in conns:
            try:
                await ws.send_text(text)
            except Exception:
                logger.warning(
                    "Failed to send to WS for exercise=%d", exercise_id
                )

    async def broadcast_to_role(
        self, exercise_id: int, role: str, message: dict[str, Any]
    ) -> None:
        """Send a JSON message only to clients with a specific role."""
        conns = self._connections.get(exercise_id)
        if not conns:
            return
        text = json.dumps(message)
        for ws, ws_role in conns:
            if ws_role == role:
                try:
                    await ws.send_text(text)
                except Exception:
                    logger.warning(
                        "Failed to send to WS role=%s exercise=%d",
                        role,
                        exercise_id,
                    )

    def get_connections(
        self, exercise_id: int
    ) -> list[tuple[WebSocket, str]]:
        """List active connections for an exercise."""
        return list(self._connections.get(exercise_id, []))


# Global singleton
connection_manager = ConnectionManager()
