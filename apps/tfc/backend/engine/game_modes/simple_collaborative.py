"""Simple-Collaborative game mode.

No GM required. Decisions chain sequentially — each opens immediately
when the previous one closes. Advisors submit recommendations in
real-time; the decision-maker makes the final call. Wrong answers
increase stress, which reduces the time available for subsequent decisions.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from engine.state_changes import DecisionOptionSnapshot, ForcedCardApplied, ScoreChange, StateChange

STRESS_TIME_TABLE: dict[int, int] = {
    0: 300_000,
    1: 290_000,
    2: 280_000,
    3: 270_000,
    4: 260_000,
    5: 250_000,
    6: 240_000,
    7: 230_000,
    8: 210_000,
    9: 190_000,
    10: 180_000,
}


@dataclass
class SimpleCollaborativeMode:
    """Strategy for the simple-collaborative exercise mode."""

    decision_sequence: list[str] = field(default_factory=list)
    base_decision_time_ms: int = 300_000
    max_possible_score: float = 0.0
    score_tier_thresholds: dict[str, float] = field(default_factory=dict)

    # Mutable runtime state
    stress: int = 0
    total_score: float = 0.0
    turn_number: int = 1
    current_index: int = 0

    def should_pause_on_decision(self) -> bool:
        return False

    def on_decision_timeout(
        self,
        decision_id: str,
        options: list[DecisionOptionSnapshot],
    ) -> str | None:
        """Auto-submit the worst option (lowest score)."""
        if not options:
            return None
        worst = min(options, key=lambda o: o.get("score", 0))
        return worst["id"]

    def on_decision_closed_v2(
        self,
        decision_id: str,
        selected_options: list[DecisionOptionSnapshot],
        all_options: list[DecisionOptionSnapshot],
        forced_option_ids: list[str] | None = None,
        turn_stress_delta: int = 0,
    ) -> list[StateChange]:
        """Score using full option lists. Enforces forced cards."""
        changes: list[StateChange] = []
        forced_ids = forced_option_ids or []

        # Check forced cards — auto-add if missing
        selected_ids = {o["id"] for o in selected_options}
        effective_options = list(selected_options)
        for fid in forced_ids:
            if fid not in selected_ids:
                forced_opt = next(
                    (o for o in all_options if o["id"] == fid),
                    None,
                )
                if forced_opt is not None:
                    effective_options.append(forced_opt)
                    change: ForcedCardApplied = {
                        "type": "forced_card_applied",
                        "decision_id": decision_id,
                        "forced_option_id": fid,
                        "reason": (
                            f"Mandatory card {fid} was not selected and has been auto-applied."
                        ),
                    }
                    changes.append(change)

        # Compute scores
        selected_score = sum(o.get("score", 0) for o in effective_options)

        # Compute stress delta: turn-level + per-card
        card_stress = sum(o.get("stress_delta", 0) for o in effective_options)
        stress_delta = turn_stress_delta + card_stress

        # Score the decision, apply stress, advance turn
        self.turn_number += 1
        self.total_score += selected_score
        self.stress = max(0, min(10, self.stress + stress_delta))
        self.current_index += 1
        score_change: ScoreChange = {
            "type": "score_change",
            "total_score": self.total_score,
            "stress": self.stress,
            "next_decision_time_ms": self.get_decision_time_ms(
                self.base_decision_time_ms,
            ),
            "turn_number": self.turn_number,
            "score_tier": self.compute_tier(),
        }
        changes.append(score_change)
        return changes

    def compute_tier(self) -> str | None:
        """Compute score tier based on thresholds. Returns None if no thresholds configured."""
        if not self.score_tier_thresholds or self.max_possible_score <= 0:
            return None
        ratio = self.total_score / self.max_possible_score
        lo = self.score_tier_thresholds.get("lo", 0.33)
        mid = self.score_tier_thresholds.get("mid", 0.66)
        if ratio < lo:
            return "lo"
        if ratio < mid:
            return "mid"
        return "hi"

    def snapshot(self) -> dict[str, object] | None:
        """Return current scoring state for client sync."""
        return {
            "total_score": self.total_score,
            "stress": self.stress,
            "turn_number": self.turn_number,
            "next_decision_time_ms": self.get_decision_time_ms(
                self.base_decision_time_ms,
            ),
            "score_tier": self.compute_tier(),
        }

    def get_next_decision_id(self, closed_decision_id: str) -> str | None:
        """Return next decision template ID in sequence, or None if done."""
        if self.current_index < len(self.decision_sequence):
            return self.decision_sequence[self.current_index]
        return None

    def get_decision_time_ms(self, base_time_ms: int) -> int:
        """Effective timer from stress lookup table.

        ``base_time_ms`` is unused — stress table provides absolute values.
        Parameter kept for GameMode protocol compatibility.
        """
        return STRESS_TIME_TABLE.get(self.stress, 180_000)

    def requires_gm(self) -> bool:
        return False
