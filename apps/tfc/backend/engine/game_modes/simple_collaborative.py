"""Simple-Collaborative game mode.

No GM required. Decisions chain sequentially — each opens immediately
when the previous one closes. Advisors submit recommendations in
real-time; the decision-maker makes the final call. Wrong answers
shrink the time available for subsequent decisions.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from engine.state_changes import ForcedCardApplied, ScoreChange


@dataclass
class SimpleCollaborativeMode:
    """Strategy for the simple-collaborative exercise mode."""

    decision_sequence: list[str] = field(default_factory=list)
    base_decision_time_ms: int = 300_000
    penalty_factor: float = 0.1
    min_decision_time_ms: int = 30_000

    # Mutable runtime state
    accumulated_penalty_ms: float = 0.0
    total_score: float = 0.0
    turn_number: int = 0
    current_index: int = 0

    def should_pause_on_decision(self) -> bool:
        return False

    def on_decision_timeout(
        self, decision_id: str, options: list[dict],
    ) -> str | None:
        """Auto-submit the worst option (lowest score)."""
        if not options:
            return None
        worst = min(options, key=lambda o: o.get("score", 0))
        return worst["id"]

    def on_decision_closed(
        self, decision_id: str, selected_score: float, max_score: float,
    ) -> list[dict]:
        """Score the decision, apply penalty, advance turn."""
        self.turn_number += 1
        self.total_score += selected_score
        penalty_ms = 0.0
        if selected_score < max_score:
            penalty_ms = (max_score - selected_score) * self.penalty_factor * 1000
            self.accumulated_penalty_ms += penalty_ms
        self.current_index += 1
        change: ScoreChange = {
            "type": "score_change",
            "total_score": self.total_score,
            "penalty_ms": penalty_ms,
            "next_decision_time_ms": self.get_decision_time_ms(
                self.base_decision_time_ms,
            ),
            "turn_number": self.turn_number,
        }
        return [change]

    def on_decision_closed_v2(
        self,
        decision_id: str,
        selected_options: list[dict],
        all_options: list[dict],
        forced_option_ids: list[str] | None = None,
    ) -> list[dict]:
        """Score using full option lists. Enforces forced cards."""
        changes: list[dict] = []
        forced_ids = forced_option_ids or []

        # Check forced cards — auto-add if missing
        selected_ids = {o["id"] for o in selected_options}
        effective_options = list(selected_options)
        for fid in forced_ids:
            if fid not in selected_ids:
                forced_opt = next(
                    (o for o in all_options if o["id"] == fid), None,
                )
                if forced_opt is not None:
                    effective_options.append(forced_opt)
                    change: ForcedCardApplied = {
                        "type": "forced_card_applied",
                        "decision_id": decision_id,
                        "forced_option_id": fid,
                        "reason": (
                            f"Mandatory card {fid} was not selected"
                            " and has been auto-applied."
                        ),
                    }
                    changes.append(change)

        # Compute scores
        n = len(effective_options)
        selected_score = sum(o.get("score", 0) for o in effective_options)
        top_n = sorted(
            (o.get("score", 0) for o in all_options), reverse=True,
        )[:n]
        max_score = sum(top_n)

        # Delegate to existing scalar scoring
        score_changes = self.on_decision_closed(
            decision_id, selected_score, max_score,
        )
        changes.extend(score_changes)
        return changes

    def get_next_decision_id(self, closed_decision_id: str) -> str | None:
        """Return next decision template ID in sequence, or None if done."""
        if self.current_index < len(self.decision_sequence):
            return self.decision_sequence[self.current_index]
        return None

    def get_decision_time_ms(self, base_time_ms: int) -> int:
        """Effective timer = base minus accumulated penalties, floored."""
        return max(
            self.min_decision_time_ms,
            base_time_ms - int(self.accumulated_penalty_ms),
        )

    def requires_gm(self) -> bool:
        return False
