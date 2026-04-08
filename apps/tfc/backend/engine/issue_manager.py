"""Manages defect (issue) lifecycle with activation triggers and auto-resolve countdowns.

Domain term: "defect". Code uses "issue" throughout.
Also known as: DefectManager, defect manager.

Defects progress through: inactive -> active -> mitigated -> resolved.
Trigger modes: time-based, inject-based (event-based), manual (GM).
Auto-resolve countdown = time in PT before the defect resolves automatically.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from engine.state_changes import IssueChange, IssueSnapshot


class IssueLifecycle(StrEnum):
    INACTIVE = "inactive"
    ACTIVE = "active"
    MITIGATED = "mitigated"
    RESOLVED = "resolved"


class TriggerMode(StrEnum):
    TIME_BASED = "time-based"
    EVENT_BASED = "event-based"
    MANUAL = "manual"


VALID_TRANSITIONS: dict[IssueLifecycle, set[IssueLifecycle]] = {
    IssueLifecycle.INACTIVE: {IssueLifecycle.ACTIVE},
    IssueLifecycle.ACTIVE: {IssueLifecycle.MITIGATED, IssueLifecycle.RESOLVED},
    IssueLifecycle.MITIGATED: {IssueLifecycle.RESOLVED},
    IssueLifecycle.RESOLVED: set(),
}


@dataclass
class TrackedIssue:
    """Runtime representation of a defect (issue) during exercise execution."""

    id: str
    title: str
    description: str
    trigger_mode: TriggerMode
    trigger_time_pt_ms: float | None = None
    trigger_event_id: str | None = None
    auto_resolve_pt_ms: float = 0.0
    auto_resolve_rt_ms: float = 0.0
    lifecycle: IssueLifecycle = IssueLifecycle.INACTIVE
    activated_at_pt_ms: float | None = None
    activated_at_rt_ms: float | None = None
    resolved_at_pt_ms: float | None = None
    released_to_players: bool = False


class IssueManager:
    """Manages defect (issue) activation, auto-resolve countdowns, and lifecycle.

    Also known as: DefectManager.
    """

    def __init__(self) -> None:
        self._issues: dict[str, TrackedIssue] = {}

    @property
    def issues(self) -> dict[str, TrackedIssue]:
        return self._issues

    def load_issues(self, issues: list[TrackedIssue]) -> None:
        self._issues = {i.id: i for i in issues}

    def clear(self) -> None:
        self._issues.clear()

    def tick(
        self,
        current_pt_ms: float,
        current_rt_ms: float,
        completed_event_ids: set[str],
    ) -> list[IssueChange]:
        """Check all issues for activation and auto-resolve expiry.

        Args:
            current_pt_ms: Current play time in milliseconds.
            current_rt_ms: Current real time in milliseconds.
            completed_event_ids: Set of event IDs that have completed.

        Returns:
            List of state change dicts for broadcasting.
        """
        changes: list[IssueChange] = []

        for issue in self._issues.values():
            if issue.lifecycle == IssueLifecycle.INACTIVE:
                if self._should_activate(issue, current_pt_ms, completed_event_ids):
                    self._activate(issue, current_pt_ms, current_rt_ms)
                    changes.append(self._change(issue, "activated"))

            if issue.lifecycle == IssueLifecycle.ACTIVE:
                pt_expired = (
                    issue.auto_resolve_pt_ms > 0
                    and issue.activated_at_pt_ms is not None
                    and (current_pt_ms - issue.activated_at_pt_ms) >= issue.auto_resolve_pt_ms
                )
                rt_expired = (
                    issue.auto_resolve_rt_ms > 0
                    and issue.activated_at_rt_ms is not None
                    and (current_rt_ms - issue.activated_at_rt_ms) >= issue.auto_resolve_rt_ms
                )
                if pt_expired or rt_expired:
                    self._transition(issue, IssueLifecycle.RESOLVED)
                    issue.resolved_at_pt_ms = current_pt_ms
                    changes.append(self._change(issue, "auto_resolve_expired"))

        return changes

    def activate_by_event(
        self,
        event_id: str,
        current_pt_ms: float,
        current_rt_ms: float = 0.0,
    ) -> list[IssueChange]:
        """Activate all issues triggered by a specific event."""
        changes: list[IssueChange] = []
        for issue in self._issues.values():
            if (
                issue.lifecycle == IssueLifecycle.INACTIVE
                and issue.trigger_mode == TriggerMode.EVENT_BASED
                and issue.trigger_event_id == event_id
            ):
                self._activate(issue, current_pt_ms, current_rt_ms)
                changes.append(self._change(issue, "activated"))
        return changes

    def manual_activate(
        self,
        issue_id: str,
        current_pt_ms: float,
        current_rt_ms: float = 0.0,
    ) -> IssueChange | None:
        """GM manually activates an issue."""
        issue = self._issues.get(issue_id)
        if not issue or issue.lifecycle != IssueLifecycle.INACTIVE:
            return None
        self._activate(issue, current_pt_ms, current_rt_ms)
        return self._change(issue, "manual_activated")

    def mitigate(self, issue_id: str) -> IssueChange | None:
        """Transition issue to mitigated state."""
        issue = self._issues.get(issue_id)
        if not issue or issue.lifecycle != IssueLifecycle.ACTIVE:
            return None
        self._transition(issue, IssueLifecycle.MITIGATED)
        return self._change(issue, "mitigated")

    def resolve(
        self,
        issue_id: str,
        current_pt_ms: float,
    ) -> IssueChange | None:
        """Resolve an active or mitigated issue."""
        issue = self._issues.get(issue_id)
        if not issue:
            return None
        if issue.lifecycle not in {IssueLifecycle.ACTIVE, IssueLifecycle.MITIGATED}:
            return None
        self._transition(issue, IssueLifecycle.RESOLVED)
        issue.resolved_at_pt_ms = current_pt_ms
        return self._change(issue, "resolved")

    def release_to_players(self, issue_id: str) -> IssueChange | None:
        """Mark an issue as visible to players."""
        issue = self._issues.get(issue_id)
        if not issue or issue.lifecycle == IssueLifecycle.INACTIVE:
            return None
        issue.released_to_players = True
        return self._change(issue, "released")

    def _should_activate(
        self,
        issue: TrackedIssue,
        current_pt_ms: float,
        completed_event_ids: set[str],
    ) -> bool:
        if issue.trigger_mode == TriggerMode.TIME_BASED:
            return (
                issue.trigger_time_pt_ms is not None and current_pt_ms >= issue.trigger_time_pt_ms
            )
        if issue.trigger_mode == TriggerMode.EVENT_BASED:
            return (
                issue.trigger_event_id is not None and issue.trigger_event_id in completed_event_ids
            )
        return False  # manual triggers don't auto-activate

    @staticmethod
    def _activate(issue: TrackedIssue, current_pt_ms: float, current_rt_ms: float = 0.0) -> None:
        issue.lifecycle = IssueLifecycle.ACTIVE
        issue.activated_at_pt_ms = current_pt_ms
        issue.activated_at_rt_ms = current_rt_ms
        issue.released_to_players = True

    @staticmethod
    def _transition(issue: TrackedIssue, target: IssueLifecycle) -> None:
        allowed = VALID_TRANSITIONS.get(issue.lifecycle, set())
        if target not in allowed:
            return
        issue.lifecycle = target

    @staticmethod
    def _change(issue: TrackedIssue, action: str) -> IssueChange:
        return {
            "type": "issue_change",
            "issue_id": issue.id,
            "action": action,
            "lifecycle": issue.lifecycle.value,
            "title": issue.title,
            "released": issue.released_to_players,
        }

    def snapshot(self) -> list[IssueSnapshot]:
        return [
            IssueSnapshot(
                id=i.id,
                title=i.title,
                description=i.description,
                trigger_mode=i.trigger_mode.value,
                auto_resolve_pt_ms=i.auto_resolve_pt_ms,
                auto_resolve_rt_ms=i.auto_resolve_rt_ms,
                lifecycle=i.lifecycle.value,
                activated_at_pt_ms=i.activated_at_pt_ms,
                activated_at_rt_ms=i.activated_at_rt_ms,
                resolved_at_pt_ms=i.resolved_at_pt_ms,
                released=i.released_to_players,
            )
            for i in self._issues.values()
        ]
