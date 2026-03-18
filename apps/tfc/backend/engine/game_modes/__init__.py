"""GameMode protocol and factory.

A GameMode defines policy hooks that the ExerciseEngine delegates to,
allowing different exercise modes (classic GM-driven, simple_collaborative)
to coexist without branching inside the engine.
"""
from __future__ import annotations

from enum import StrEnum
from typing import Protocol

from engine.game_modes.classic import ClassicMode


class GameModeName(StrEnum):
    """Single source of truth for game mode identifiers.

    StrEnum values ARE strings, so ``GameModeName.CLASSIC == "classic"``
    is True — JSON, Pydantic, and SQLAlchemy all work without converters.
    """
    CLASSIC = "classic"
    SIMPLE_COLLABORATIVE = "simple_collaborative"


# Back-compat aliases — import these when you only need the string value
GM_CLASSIC = GameModeName.CLASSIC
GM_SIMPLE_COLLABORATIVE = GameModeName.SIMPLE_COLLABORATIVE
VALID_GAME_MODES: frozenset[str] = frozenset(GameModeName)


class GameMode(Protocol):
    """Policy interface consumed by ExerciseEngine."""

    def should_pause_on_decision(self) -> bool:
        """Return True if the engine should pause when a decision opens."""
        ...

    def on_decision_timeout(
        self, decision_id: str, options: list[dict],
    ) -> str | None:
        """Return option ID to auto-submit on timeout, or None."""
        ...

    def on_decision_closed_v2(
        self,
        decision_id: str,
        selected_options: list[dict],
        all_options: list[dict],
        forced_option_ids: list[str] | None = None,
    ) -> list[dict]:
        """Score from full option lists. Enforces forced cards."""
        ...

    def snapshot(self) -> dict | None:
        """Return current scoring state for client sync, or None."""
        ...

    def get_next_decision_id(self, closed_decision_id: str) -> str | None:
        """Return the next decision template ID in sequence, or None."""
        ...

    def get_decision_time_ms(self, base_time_ms: int) -> int:
        """Return the effective decision timer duration in ms."""
        ...

    def requires_gm(self) -> bool:
        """Return True if the mode requires a Game Master to drive."""
        ...


def create_game_mode(name: str, config: dict | None = None) -> GameMode:
    """Factory: create a GameMode by name.

    Raises ValueError for unknown game modes — fail fast, not silently.
    """
    mode = GameModeName(name)  # ValueError on unknown strings
    if mode is GameModeName.SIMPLE_COLLABORATIVE:
        from engine.game_modes.simple_collaborative import SimpleCollaborativeMode
        cfg = config or {}
        return SimpleCollaborativeMode(
            decision_sequence=cfg.get("decision_sequence", []),
            base_decision_time_ms=cfg.get("base_decision_time_ms", 300_000),
            penalty_factor=cfg.get("penalty_factor", 0.1),
            min_decision_time_ms=cfg.get("min_decision_time_ms", 30_000),
        )
    return ClassicMode()
