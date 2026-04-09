"""Presence broadcasting for connected participants.

Assembles a presence list by cross-referencing active WebSocket connections
with the waiting room participant registry, then broadcasts to GMs.
"""
from __future__ import annotations

import logging
from typing import Any

from features.exercise.adapters.connection_manager import connection_manager
from features.waiting_room.waiting_room_store import waiting_room_store

logger = logging.getLogger(__name__)


def _build_presence_list(exercise_id: int) -> list[dict[str, Any]]:
    """Build a presence list for the given exercise."""
    connected_ids = set(
        connection_manager.get_connected_participant_ids(exercise_id)
    )
    participants = waiting_room_store.list_participants(exercise_id)
    presence: list[dict[str, Any]] = []
    for p in participants:
        presence.append({
            "id": p.id,
            "display_name": p.display_name,
            "role": p.role,
            "connected": p.id in connected_ids,
        })
    return presence


async def broadcast_presence(exercise_id: int) -> None:
    """Broadcast current presence state to all GMs of an exercise."""
    presence_list = _build_presence_list(exercise_id)
    message = {
        "type": "state_changes",
        "changes": [{
            "type": "presence_update",
            "participants": presence_list,
        }],
    }
    await connection_manager.broadcast_to_role(exercise_id, "gm", message)
