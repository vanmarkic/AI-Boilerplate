"""GameMode protocol and factory.

A GameMode defines policy hooks that the ExerciseEngine delegates to,
allowing different exercise modes (classic trainer-driven, simple_collaborative)
to coexist without branching inside the engine.
"""

from __future__ import annotations

from enum import StrEnum

from engine.game_modes.classic import ClassicMode
from engine.game_modes.protocol import GameMode


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


def create_game_mode(name: str, config: dict[str, object] | None = None) -> GameMode:
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
            max_possible_score=cfg.get("max_possible_score", 0.0),
            score_tier_thresholds=cfg.get("score_tier_thresholds", {}),
        )
    return ClassicMode()
