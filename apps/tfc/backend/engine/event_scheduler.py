"""Schedules and manages event lifecycle transitions.

Events progress through: scheduled -> pending -> running -> completed/cancelled.
Events can have dependencies on other events and can trigger issues.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum


class EventLifecycle(StrEnum):
    SCHEDULED = "scheduled"
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class EventType(StrEnum):
    INFORMATIONAL = "informational"
    OPERATIONAL = "operational"
    DECISION = "decision"


VALID_TRANSITIONS: dict[EventLifecycle, set[EventLifecycle]] = {
    EventLifecycle.SCHEDULED: {EventLifecycle.PENDING, EventLifecycle.CANCELLED},
    EventLifecycle.PENDING: {EventLifecycle.RUNNING, EventLifecycle.CANCELLED},
    EventLifecycle.RUNNING: {
        EventLifecycle.PAUSED,
        EventLifecycle.COMPLETED,
        EventLifecycle.CANCELLED,
    },
    EventLifecycle.PAUSED: {EventLifecycle.RUNNING, EventLifecycle.CANCELLED},
    EventLifecycle.COMPLETED: set(),
    EventLifecycle.CANCELLED: set(),
}


@dataclass
class ScheduledEvent:
    """Runtime representation of an event during exercise execution."""
    id: str
    title: str
    description: str
    event_type: EventType
    scheduled_pt_ms: float
    duration_ms: float | None = None
    dependencies: list[str] = field(default_factory=list)
    triggered_issues: list[str] = field(default_factory=list)
    lifecycle: EventLifecycle = EventLifecycle.SCHEDULED
    started_at_pt_ms: float | None = None
    completed_at_pt_ms: float | None = None


class EventScheduler:
    """Manages event scheduling and lifecycle transitions."""

    def __init__(self) -> None:
        self._events: dict[str, ScheduledEvent] = {}

    @property
    def events(self) -> dict[str, ScheduledEvent]:
        return self._events

    def load_events(self, events: list[ScheduledEvent]) -> None:
        """Load events from a scenario definition."""
        self._events = {e.id: e for e in events}

    def clear(self) -> None:
        self._events.clear()

    def tick(self, current_pt_ms: float) -> list[dict]:
        """Check all events and apply lifecycle transitions.

        Returns a list of state change dicts for broadcasting.
        """
        changes: list[dict] = []

        for event in self._events.values():
            if event.lifecycle == EventLifecycle.SCHEDULED:
                if self._should_activate(event, current_pt_ms):
                    self._transition(event, EventLifecycle.PENDING)
                    changes.append(self._change(event, "activated"))

            elif event.lifecycle == EventLifecycle.PENDING:
                self._transition(event, EventLifecycle.RUNNING)
                event.started_at_pt_ms = current_pt_ms
                changes.append(self._change(event, "started"))

            elif event.lifecycle == EventLifecycle.RUNNING and event.duration_ms:
                if event.started_at_pt_ms is not None:
                    elapsed = current_pt_ms - event.started_at_pt_ms
                    if elapsed >= event.duration_ms:
                        self._transition(event, EventLifecycle.COMPLETED)
                        event.completed_at_pt_ms = current_pt_ms
                        changes.append(self._change(event, "completed"))

        return changes

    def force_trigger(self, event_id: str, current_pt_ms: float) -> dict | None:
        """GM manually triggers an event regardless of schedule."""
        event = self._events.get(event_id)
        if not event:
            return None
        if event.lifecycle in {EventLifecycle.COMPLETED, EventLifecycle.CANCELLED}:
            return None
        # GM override — bypass normal transition rules
        event.lifecycle = EventLifecycle.RUNNING
        event.started_at_pt_ms = current_pt_ms
        return self._change(event, "force_triggered")

    def cancel_event(self, event_id: str) -> dict | None:
        """GM cancels an event."""
        event = self._events.get(event_id)
        if not event:
            return None
        if event.lifecycle in {EventLifecycle.COMPLETED, EventLifecycle.CANCELLED}:
            return None
        self._transition(event, EventLifecycle.CANCELLED)
        return self._change(event, "cancelled")

    def complete_event(self, event_id: str, current_pt_ms: float) -> dict | None:
        """GM manually completes a running event."""
        event = self._events.get(event_id)
        if not event or event.lifecycle != EventLifecycle.RUNNING:
            return None
        self._transition(event, EventLifecycle.COMPLETED)
        event.completed_at_pt_ms = current_pt_ms
        return self._change(event, "completed")

    def get_triggered_issues(self, event_id: str) -> list[str]:
        """Get issue IDs triggered by a completed event."""
        event = self._events.get(event_id)
        if not event:
            return []
        return event.triggered_issues

    def _should_activate(
        self, event: ScheduledEvent, current_pt_ms: float,
    ) -> bool:
        """Check if event should transition from scheduled to pending."""
        if current_pt_ms < event.scheduled_pt_ms:
            return False
        # Check dependencies are completed
        for dep_id in event.dependencies:
            dep = self._events.get(dep_id)
            if not dep or dep.lifecycle != EventLifecycle.COMPLETED:
                return False
        return True

    @staticmethod
    def _transition(event: ScheduledEvent, target: EventLifecycle) -> None:
        allowed = VALID_TRANSITIONS.get(event.lifecycle, set())
        if target not in allowed:
            return
        event.lifecycle = target

    @staticmethod
    def _change(event: ScheduledEvent, action: str) -> dict:
        return {
            "type": "event_change",
            "event_id": event.id,
            "action": action,
            "lifecycle": event.lifecycle.value,
            "title": event.title,
        }

    def snapshot(self) -> list[dict]:
        """Return all events as serializable dicts."""
        return [
            {
                "id": e.id,
                "title": e.title,
                "description": e.description,
                "event_type": e.event_type.value,
                "scheduled_pt_ms": e.scheduled_pt_ms,
                "duration_ms": e.duration_ms,
                "dependencies": e.dependencies,
                "lifecycle": e.lifecycle.value,
                "started_at_pt_ms": e.started_at_pt_ms,
                "completed_at_pt_ms": e.completed_at_pt_ms,
            }
            for e in self._events.values()
        ]
