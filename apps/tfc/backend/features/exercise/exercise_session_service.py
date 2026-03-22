"""Application service that orchestrates exercise stop/cleanup.

Coordinates engine completion, WebSocket teardown, waiting room flush,
and session store removal into a single use-case method.
"""

from __future__ import annotations

import logging

from collections.abc import Awaitable, Callable

from engine.exercise_engine import EnginePhase, EngineStateError
from engine.session_store import SessionStore
from engine.state_changes import PhaseChange
from features.exercise.adapters.connection_manager import ConnectionManager
from features.waiting_room.waiting_room_store import WaitingRoomStore

logger = logging.getLogger(__name__)


class ExerciseSessionService:
    """Orchestrates the full teardown of an exercise session."""

    def __init__(
        self,
        session_store: SessionStore,
        connection_manager: ConnectionManager,
        waiting_room_store: WaitingRoomStore,
    ) -> None:
        self._sessions = session_store
        self._connections = connection_manager
        self._waiting_room = waiting_room_store

    async def stop(
        self,
        exercise_id: int,
        *,
        reason: str = "stopped_by_gm",
    ) -> None:
        """Stop an exercise and flush all associated resources.

        1. Complete the engine (if running/paused/briefing)
        2. Broadcast exercise_stopped to all WS clients
        3. Server-close all WebSocket connections
        4. Clear waiting room
        5. Remove engine from session store
        """
        engine = self._sessions.get(exercise_id)
        if engine is not None and engine.phase != EnginePhase.COMPLETED:
            try:
                await engine.complete()
            except EngineStateError:
                logger.warning(
                    "Could not complete engine for exercise=%d (phase=%s)",
                    exercise_id,
                    engine.phase,
                )

        await self._connections.broadcast(
            exercise_id,
            {
                "type": "exercise_stopped",
                "exercise_id": exercise_id,
                "reason": reason,
            },
        )

        closed = await self._connections.close_all(exercise_id)
        logger.info(
            "Stopped exercise=%d: closed %d WS connections, reason=%s",
            exercise_id,
            closed,
            reason,
        )

        self._waiting_room.clear(exercise_id)
        self._sessions.remove(exercise_id)

    async def complete(
        self,
        exercise_id: int,
        broadcast_fn: Callable[[list], Awaitable[None]] | None = None,
        audit_fn: Callable[[int, list], Awaitable[None]] | None = None,
    ) -> PhaseChange | None:
        """Complete the engine without teardown (for completion overlay).

        Unlike stop(), this keeps the engine alive and WS connections open
        so clients can render the completion overlay.
        """
        engine = self._sessions.get(exercise_id)
        if engine is None:
            return None
        try:
            result = await engine.complete()
        except EngineStateError:
            logger.warning(
                "Could not complete engine for exercise=%d (phase=%s)",
                exercise_id,
                engine.phase,
            )
            return None
        if broadcast_fn:
            await broadcast_fn([result])
        if audit_fn:
            await audit_fn(exercise_id, [result])
        return result
