"""Manages in-flight decision points during exercise execution.

Passive tracker — does not control the engine directly.
The engine checks decision state in its tick loop.
"""

from __future__ import annotations

import time as _time_mod
from dataclasses import dataclass, field

from engine.state_changes import (
    DecisionClosed,
    DecisionOpened,
    DecisionOptionSnapshot,
    DecisionSnapshot,
    RecommendationSubmitted,
)


@dataclass
class ActiveDecision:
    """Runtime representation of a decision point."""

    id: str
    event_id: str | None
    issue_id: str | None
    title: str
    description: str
    question_type: str
    options: list[DecisionOptionSnapshot]
    completion_mode: str
    target_roles: list[str]
    timeout_ms: float = 0.0  # 0 = no timeout
    status: str = "open"  # open, closed, timed_out
    opened_at_pt_ms: float = 0.0
    opened_at_rt_ms: float = 0.0  # wall clock for timeout tracking
    closed_at_pt_ms: float | None = None
    recommendations: dict[str, str] = field(default_factory=dict)
    selected_option_ids: list[str] = field(default_factory=list)


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
        options: list[DecisionOptionSnapshot],
        completion_mode: str,
        target_roles: list[str],
        timeout_ms: float = 0.0,
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
        self,
        decision_id: str,
        *,
        current_pt_ms: float,
        selected_option_ids: list[str] | None = None,
    ) -> DecisionClosed | None:
        """Close a decision. Returns a change dict or None."""
        decision = self._decisions.get(decision_id)
        if decision is None or decision.status == "closed":
            return None
        decision.status = "closed"
        decision.closed_at_pt_ms = current_pt_ms
        decision.selected_option_ids = selected_option_ids or []
        return {
            "type": "decision_closed",
            "decision_id": decision_id,
            "title": decision.title,
            "selected_option_ids": decision.selected_option_ids,
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
                changes.append(
                    {
                        "type": "decision_closed",
                        "decision_id": d.id,
                        "title": d.title,
                    }
                )
        return changes

    def submit_recommendation(
        self,
        decision_id: str,
        participant_id: str,
        option_id: str,
        role_id: str | None = None,
    ) -> RecommendationSubmitted | None:
        """Record an advisor's recommendation. Returns a change dict or None.

        When *role_id* is provided the recommendation is keyed as
        ``participant_id:role_id`` so that a single participant can submit
        one recommendation per role (used by the all-advisors 2-player mode).
        """
        decision = self._decisions.get(decision_id)
        if decision is None or decision.status != "open":
            return None
        key = f"{participant_id}:{role_id}" if role_id else participant_id
        decision.recommendations[key] = option_id
        return {
            "type": "recommendation_submitted",
            "decision_id": decision_id,
            "participant_id": key,
            "option_id": option_id,
        }

    def get_decision(self, decision_id: str) -> ActiveDecision | None:
        """Look up a decision by ID, regardless of status."""
        return self._decisions.get(decision_id)

    def get_open_decisions(self) -> list[ActiveDecision]:
        """Return only decisions with status 'open'."""
        return [d for d in self._decisions.values() if d.status == "open"]

    def snapshot(self) -> list[DecisionSnapshot]:
        """Return all decisions as serializable dicts."""
        return [
            DecisionSnapshot(
                id=d.id,
                event_id=d.event_id,
                issue_id=d.issue_id,
                title=d.title,
                description=d.description,
                question_type=d.question_type,
                options=d.options,
                completion_mode=d.completion_mode,
                target_roles=d.target_roles,
                timeout_ms=d.timeout_ms,
                status=d.status,
                opened_at_pt_ms=d.opened_at_pt_ms,
                closed_at_pt_ms=d.closed_at_pt_ms,
                recommendations=dict(d.recommendations),
                selected_option_ids=list(d.selected_option_ids),
            )
            for d in self._decisions.values()
        ]

    def clear(self) -> None:
        """Remove all tracked decisions."""
        self._decisions.clear()
