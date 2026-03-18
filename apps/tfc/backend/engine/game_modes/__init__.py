"""GameMode protocol and factory.

A GameMode defines policy hooks that the ExerciseEngine delegates to,
allowing different exercise modes (classic GM-driven, simple-collaborative)
to coexist without branching inside the engine.
"""
from __future__ import annotations

from typing import Protocol

from engine.game_modes.classic import ClassicMode


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

    def on_decision_closed(
        self, decision_id: str, selected_score: float, max_score: float,
    ) -> list[dict]:
        """Return extra state-change dicts to broadcast after a decision closes."""
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
    """Factory: create a GameMode by name."""
    if name == "simple-collaborative":
        from engine.game_modes.simple_collaborative import SimpleCollaborativeMode
        cfg = config or {}
        return SimpleCollaborativeMode(
            decision_sequence=cfg.get("decision_sequence", []),
            base_decision_time_ms=cfg.get("base_decision_time_ms", 300_000),
            penalty_factor=cfg.get("penalty_factor", 0.1),
            min_decision_time_ms=cfg.get("min_decision_time_ms", 30_000),
        )
    return ClassicMode()
