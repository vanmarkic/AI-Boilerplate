"""Classic game mode — GM-driven, pause-on-decision, no scoring."""
from __future__ import annotations

from dataclasses import dataclass

from engine.state_changes import DecisionOptionSnapshot, StateChange


@dataclass
class ClassicMode:
    """Reproduces the original engine behaviour as a GameMode strategy."""

    def should_pause_on_decision(self) -> bool:
        return True

    def on_decision_timeout(
        self, decision_id: str, options: list[DecisionOptionSnapshot],
    ) -> str | None:
        return None

    def on_decision_closed_v2(
        self,
        decision_id: str,
        selected_options: list[DecisionOptionSnapshot],
        all_options: list[DecisionOptionSnapshot],
        forced_option_ids: list[str] | None = None,
    ) -> list[StateChange]:
        return []

    def snapshot(self) -> dict[str, object] | None:
        """Classic mode has no scoring state."""
        return None

    def get_next_decision_id(self, closed_decision_id: str) -> str | None:
        return None

    def get_decision_time_ms(self, base_time_ms: int) -> int:
        return base_time_ms

    def requires_gm(self) -> bool:
        return True
