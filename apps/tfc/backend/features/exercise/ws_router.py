"""WebSocket endpoint for real-time exercise state updates.

Clients connect with a role (gm or player) and receive state change
broadcasts from the exercise engine tick loop.
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from features.exercise.adapters.connection_manager import connection_manager
from features.exercise.adapters.presence_service import broadcast_presence

logger = logging.getLogger(__name__)

ws_router = APIRouter(tags=["exercise-ws"])


@ws_router.websocket("/api/exercises/{exercise_id}/ws")
async def exercise_ws(
    websocket: WebSocket,
    exercise_id: int,
    role: str = Query(default="player"),
    participant_id: str | None = Query(default=None),
) -> None:
    """WebSocket endpoint for exercise real-time updates.

    Query params:
        role: "gm" or "player" (default: "player")
        participant_id: optional participant identifier for presence tracking
    """
    await websocket.accept()
    connection_manager.connect(exercise_id, websocket, role, participant_id)
    await broadcast_presence(exercise_id)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if data.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass
    finally:
        connection_manager.disconnect(exercise_id, websocket)
        await broadcast_presence(exercise_id)
