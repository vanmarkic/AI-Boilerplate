"""In-memory store for active exercise engine instances.

Maps exercise_id -> ExerciseEngine for all running/paused sessions.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from engine.exercise_engine import EngineConfig, ExerciseEngine


class SessionStore:
    """Singleton store for active exercise sessions."""

    def __init__(self) -> None:
        self._sessions: dict[int, ExerciseEngine] = {}

    def get(self, exercise_id: int) -> ExerciseEngine | None:
        return self._sessions.get(exercise_id)

    def create(
        self,
        config: EngineConfig,
        on_state_change: Callable[[list[dict]], Awaitable[None]] | None = None,
    ) -> ExerciseEngine:
        """Create a new engine session.

        Raises ValueError if a session already exists for the exercise ID.
        Call remove() first if you need to replace an existing session.
        """
        if config.exercise_id in self._sessions:
            raise ValueError(
                f"Engine already exists for exercise_id={config.exercise_id}. "
                "Remove the existing session before creating a new one."
            )
        engine = ExerciseEngine(config, on_state_change=on_state_change)
        self._sessions[config.exercise_id] = engine
        return engine

    def remove(self, exercise_id: int) -> bool:
        return self._sessions.pop(exercise_id, None) is not None

    def list_active(self) -> list[int]:
        return list(self._sessions.keys())

    @property
    def count(self) -> int:
        return len(self._sessions)


# Global singleton
session_store = SessionStore()
