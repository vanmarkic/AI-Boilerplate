"""GameMode protocol — the strategy interface consumed by ExerciseEngine.

Extracted to its own module so that ``engine_config.py`` can annotate
``game_mode: GameMode`` without importing the full ``game_modes/__init__``
(which carries the factory and concrete imports).
"""

from __future__ import annotations

from typing import Protocol

from engine.state_changes import DecisionOptionSnapshot, StateChange


class GameMode(Protocol):
    """Policy interface consumed by ExerciseEngine."""

    def should_pause_on_decision(self) -> bool:
        """Return True if the engine should pause when a decision opens."""
        ...

    def on_decision_timeout(
        self,
        decision_id: str,
        options: list[DecisionOptionSnapshot],
    ) -> str | None:
        """Return option ID to auto-submit on timeout, or None."""
        ...

    def on_decision_closed_v2(
        self,
        decision_id: str,
        selected_options: list[DecisionOptionSnapshot],
        all_options: list[DecisionOptionSnapshot],
        forced_option_ids: list[str] | None = None,
    ) -> list[StateChange]:
        """Score from full option lists. Enforces forced cards."""
        ...

    def snapshot(self) -> dict[str, object] | None:
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
