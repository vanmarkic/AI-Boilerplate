"""Manages in-flight decision points during exercise execution.

Passive tracker — does not control the engine directly.
The engine checks decision state in its tick loop.
"""
from __future__ import annotations

import time as _time_mod
from dataclasses import dataclass, field

from engine.state_changes import DecisionClosed, DecisionOpened


@dataclass
class Recommendation:
    """A single role recommendation submitted for a decision."""
    role: str
    participant_id: str


@dataclass
class ActiveDecision:
    """Runtime representation of a decision point."""
    id: str
    inject_id: str | None
    defect_id: str | None
    title: str
    description: str
    question_type: str
    options: list[dict]
    completion_mode: str
    target_roles: list[str]
    timeout_ms: float = 0.0  # 0 = no timeout
    status: str = "open"  # open, closed, timed_out
    opened_at_pt_ms: float = 0.0
    opened_at_rt_ms: float = 0.0  # wall clock for timeout tracking
    closed_at_pt_ms: float | None = None
    recommendations: list[Recommendation] = field(default_factory=list)


class DecisionManager:
    """Tracks active decision requests during an exercise."""

    def __init__(self) -> None:
        self._decisions: dict[str, ActiveDecision] = {}

    def open_decision(
        self,
        *,
        id: str,
        inject_id: str | None,
        defect_id: str | None,
        title: str,
        description: str,
        question_type: str,
        options: list[dict],
        completion_mode: str,
        target_roles: list[str],
        timeout_ms: float = 0.0,
        current_pt_ms: float,
    ) -> DecisionOpened:
        """Register a new open decision. Returns a change dict."""
        decision = ActiveDecision(
            id=id,
            inject_id=inject_id,
            defect_id=defect_id,
            title=title,
            description=description,
            question_type=question_type,
            options=options,
            completion_mode=completion_mode,
            target_roles=target_roles,
            timeout_ms=timeout_ms,
            status="open",
            opened_at_pt_ms=current_pt_ms,
            opened_at_rt_ms=_time_mod.monotonic() * 1000,
        )
        self._decisions[id] = decision
        return {
            "type": "decision_opened",
            "decision_id": id,
            "title": title,
            "question_type": question_type,
            "options": options,
            "target_roles": target_roles,
            "timeout_ms": timeout_ms,
        }

    def close_decision(
        self, decision_id: str, *, current_pt_ms: float,
    ) -> DecisionClosed | None:
        """Close a decision. Returns a change dict or None."""
        decision = self._decisions.get(decision_id)
        if decision is None or decision.status == "closed":
            return None
        decision.status = "closed"
        decision.closed_at_pt_ms = current_pt_ms
        return {
            "type": "decision_closed",
            "decision_id": decision_id,
            "title": decision.title,
        }

    def tick(self, current_pt_ms: float) -> list[DecisionClosed]:
        """Check open decisions for timeout expiry. Returns changes."""
        changes: list[DecisionClosed] = []
        for d in self._decisions.values():
            if d.status != "open" or d.timeout_ms <= 0:
                continue
            elapsed = current_pt_ms - d.opened_at_pt_ms
            if elapsed >= d.timeout_ms:
                d.status = "timed_out"
                d.closed_at_pt_ms = current_pt_ms
                changes.append({
                    "type": "decision_closed",
                    "decision_id": d.id,
                    "title": d.title,
                })
        return changes

    def record_recommendation(
        self, decision_id: str, *, role: str, participant_id: str,
    ) -> None:
        """Record that a role has submitted a recommendation."""
        decision = self._decisions.get(decision_id)
        if decision is None:
            return
        decision.recommendations.append(
            Recommendation(role=role, participant_id=participant_id),
        )

    def all_target_roles_responded(self, decision_id: str) -> bool:
        """Check if every target role has at least one recommendation."""
        decision = self._decisions.get(decision_id)
        if not decision or not decision.target_roles:
            return False
        responded_roles = {r.role for r in decision.recommendations}
        return all(role in responded_roles for role in decision.target_roles)

    def get_open_decisions(self) -> list[ActiveDecision]:
        """Return only decisions with status 'open'."""
        return [d for d in self._decisions.values() if d.status == "open"]

    def snapshot(self) -> list[dict]:
        """Return all decisions as serializable dicts."""
        return [
            {
                "id": d.id,
                "inject_id": d.inject_id,
                "defect_id": d.defect_id,
                "title": d.title,
                "description": d.description,
                "question_type": d.question_type,
                "options": d.options,
                "completion_mode": d.completion_mode,
                "target_roles": d.target_roles,
                "timeout_ms": d.timeout_ms,
                "status": d.status,
                "opened_at_pt_ms": d.opened_at_pt_ms,
                "closed_at_pt_ms": d.closed_at_pt_ms,
            }
            for d in self._decisions.values()
        ]

    def clear(self) -> None:
        """Remove all tracked decisions."""
        self._decisions.clear()
