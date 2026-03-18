"""WebSocket connection manager for real-time exercise broadcasts.

Tracks connected clients per exercise_id with their role (gm/player).
Thread-safe by design: asyncio is single-threaded, so no locks needed.
"""

from __future__ import annotations

import json
import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections grouped by exercise_id and role."""

    def __init__(self) -> None:
        self._connections: dict[int, list[tuple[WebSocket, str, str | None]]] = {}

    def connect(
        self,
        exercise_id: int,
        websocket: WebSocket,
        role: str,
        participant_id: str | None = None,
    ) -> None:
        """Register a new WebSocket client for an exercise."""
        if exercise_id not in self._connections:
            self._connections[exercise_id] = []
        self._connections[exercise_id].append((websocket, role, participant_id))
        logger.info(
            "WS connected: exercise=%d role=%s participant=%s",
            exercise_id,
            role,
            participant_id,
        )

    def disconnect(self, exercise_id: int, websocket: WebSocket) -> None:
        """Remove a WebSocket client. No-op if not found."""
        conns = self._connections.get(exercise_id)
        if conns is None:
            return
        self._connections[exercise_id] = [
            (ws, r, pid) for ws, r, pid in conns if ws is not websocket
        ]
        if not self._connections[exercise_id]:
            del self._connections[exercise_id]
        logger.info("WS disconnected: exercise=%d", exercise_id)

    async def broadcast(self, exercise_id: int, message: dict[str, object]) -> None:
        """Send a JSON message to all clients of an exercise."""
        conns = self._connections.get(exercise_id)
        if not conns:
            return
        text = json.dumps(message)
        dead: list[WebSocket] = []
        for ws, _role, _pid in conns:
            try:
                await ws.send_text(text)
            except Exception:
                logger.warning("Failed to send to WS for exercise=%d", exercise_id)
                dead.append(ws)
        for ws in dead:
            self.disconnect(exercise_id, ws)

    async def broadcast_to_role(
        self, exercise_id: int, role: str, message: dict[str, object]
    ) -> None:
        """Send a JSON message only to clients with a specific role."""
        conns = self._connections.get(exercise_id)
        if not conns:
            return
        text = json.dumps(message)
        dead: list[WebSocket] = []
        for ws, ws_role, _pid in conns:
            if ws_role == role:
                try:
                    await ws.send_text(text)
                except Exception:
                    logger.warning(
                        "Failed to send to WS role=%s exercise=%d",
                        role,
                        exercise_id,
                    )
                    dead.append(ws)
        for ws in dead:
            self.disconnect(exercise_id, ws)

    def get_connections(self, exercise_id: int) -> list[tuple[WebSocket, str]]:
        """List active connections for an exercise (ws, role)."""
        return [(ws, role) for ws, role, _pid in self._connections.get(exercise_id, [])]

    def get_connected_participant_ids(self, exercise_id: int) -> list[str]:
        """Return participant IDs of currently connected clients."""
        return [
            pid for _ws, _role, pid in self._connections.get(exercise_id, []) if pid is not None
        ]


# Global singleton
connection_manager = ConnectionManager()
