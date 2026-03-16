"""Manages in-flight decision points during exercise execution.

Passive tracker — does not control the engine directly.
The engine checks decision state in its tick loop.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from engine.state_changes import DecisionClosed, DecisionOpened


@dataclass
class ActiveDecision:
    """Runtime representation of a decision point."""
    id: str
    event_id: str | None
    issue_id: str | None
    title: str
    description: str
    question_type: str
    options: list[dict]
    completion_mode: str
    target_roles: list[str]
    status: str = "open"  # open, closed
    opened_at_pt_ms: float = 0.0
    closed_at_pt_ms: float | None = None


class DecisionManager:
    """Tracks active decision requests during an exercise."""

    def __init__(self) -> None:
        self._decisions: dict[str, ActiveDecision] = {}

    def open_decision(
        self,
        *,
        id: str,
        event_id: str | None,
        issue_id: str | None,
        title: str,
        description: str,
        question_type: str,
        options: list[dict],
        completion_mode: str,
        target_roles: list[str],
        current_pt_ms: float,
    ) -> DecisionOpened:
        """Register a new open decision. Returns a change dict."""
        decision = ActiveDecision(
            id=id,
            event_id=event_id,
            issue_id=issue_id,
            title=title,
            description=description,
            question_type=question_type,
            options=options,
            completion_mode=completion_mode,
            target_roles=target_roles,
            status="open",
            opened_at_pt_ms=current_pt_ms,
        )
        self._decisions[id] = decision
        return {
            "type": "decision_opened",
            "decision_id": id,
            "title": title,
            "question_type": question_type,
            "options": options,
            "target_roles": target_roles,
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

    def get_open_decisions(self) -> list[ActiveDecision]:
        """Return only decisions with status 'open'."""
        return [d for d in self._decisions.values() if d.status == "open"]

    def snapshot(self) -> list[dict]:
        """Return all decisions as serializable dicts."""
        return [
            {
                "id": d.id,
                "event_id": d.event_id,
                "issue_id": d.issue_id,
                "title": d.title,
                "description": d.description,
                "question_type": d.question_type,
                "options": d.options,
                "completion_mode": d.completion_mode,
                "target_roles": d.target_roles,
                "status": d.status,
                "opened_at_pt_ms": d.opened_at_pt_ms,
                "closed_at_pt_ms": d.closed_at_pt_ms,
            }
            for d in self._decisions.values()
        ]

    def clear(self) -> None:
        """Remove all tracked decisions."""
        self._decisions.clear()
