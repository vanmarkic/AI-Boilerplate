"""In-memory store for active exercise engine instances.

Maps exercise_id -> ExerciseEngine for all running/paused sessions.
"""
from __future__ import annotations

from engine.exercise_engine import ExerciseEngine, EngineConfig


class SessionStore:
    """Singleton store for active exercise sessions."""

    def __init__(self) -> None:
        self._sessions: dict[int, ExerciseEngine] = {}

    def get(self, exercise_id: int) -> ExerciseEngine | None:
        return self._sessions.get(exercise_id)

    def create(self, config: EngineConfig) -> ExerciseEngine:
        """Create a new engine session. Overwrites any existing session."""
        engine = ExerciseEngine(config)
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
