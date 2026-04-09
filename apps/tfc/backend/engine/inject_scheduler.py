"""Schedules and manages inject lifecycle transitions.

Injects progress through: scheduled -> pending -> running -> completed/cancelled.
Injects can have dependencies on other injects and can trigger defects.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

from engine.state_changes import InjectChange


class InjectLifecycle(StrEnum):
    SCHEDULED = "scheduled"
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class InjectType(StrEnum):
    INFORMATIONAL = "informational"
    OPERATIONAL = "operational"
    DECISION = "decision"


class ExecutionMode(StrEnum):
    AUTOMATIC = "automatic"
    MANUAL = "manual"


VALID_TRANSITIONS: dict[InjectLifecycle, set[InjectLifecycle]] = {
    InjectLifecycle.SCHEDULED: {InjectLifecycle.PENDING, InjectLifecycle.CANCELLED},
    InjectLifecycle.PENDING: {InjectLifecycle.RUNNING, InjectLifecycle.CANCELLED},
    InjectLifecycle.RUNNING: {
        InjectLifecycle.PAUSED,
        InjectLifecycle.COMPLETED,
        InjectLifecycle.CANCELLED,
    },
    InjectLifecycle.PAUSED: {InjectLifecycle.RUNNING, InjectLifecycle.CANCELLED},
    InjectLifecycle.COMPLETED: set(),
    InjectLifecycle.CANCELLED: set(),
}


@dataclass
class ScheduledInject:
    """Runtime representation of an inject during exercise execution."""
    id: str
    title: str
    description: str
    inject_type: InjectType
    scheduled_pt_ms: float
    duration_ms: float | None = None
    dependencies: list[str] = field(default_factory=list)
    triggered_defects: list[str] = field(default_factory=list)
    execution_mode: ExecutionMode = ExecutionMode.AUTOMATIC
    lifecycle: InjectLifecycle = InjectLifecycle.SCHEDULED
    started_at_pt_ms: float | None = None
    completed_at_pt_ms: float | None = None


class InjectScheduler:
    """Manages inject scheduling and lifecycle transitions."""

    def __init__(self) -> None:
        self._injects: dict[str, ScheduledInject] = {}

    @property
    def injects(self) -> dict[str, ScheduledInject]:
        return self._injects

    def load_injects(self, injects: list[ScheduledInject]) -> None:
        """Load injects from a scenario definition."""
        self._injects = {e.id: e for e in injects}

    def clear(self) -> None:
        self._injects.clear()

    def tick(self, current_pt_ms: float) -> list[dict]:
        """Check all injects and apply lifecycle transitions.

        Returns a list of state change dicts for broadcasting.
        """
        changes: list[dict] = []

        for inject in self._injects.values():
            if inject.lifecycle == InjectLifecycle.SCHEDULED:
                if self._should_activate(inject, current_pt_ms):
                    self._transition(inject, InjectLifecycle.PENDING)
                    changes.append(self._change(inject, "activated"))

            elif inject.lifecycle == InjectLifecycle.PENDING:
                self._transition(inject, InjectLifecycle.RUNNING)
                inject.started_at_pt_ms = current_pt_ms
                changes.append(self._change(inject, "started"))

            elif inject.lifecycle == InjectLifecycle.PAUSED:
                pass  # paused injects do not tick

            elif inject.lifecycle == InjectLifecycle.RUNNING and inject.duration_ms:
                if inject.started_at_pt_ms is not None:
                    elapsed = current_pt_ms - inject.started_at_pt_ms
                    if elapsed >= inject.duration_ms:
                        self._transition(inject, InjectLifecycle.COMPLETED)
                        inject.completed_at_pt_ms = current_pt_ms
                        changes.append(self._change(inject, "completed"))

        return changes

    def force_trigger(self, inject_id: str, current_pt_ms: float) -> dict | None:
        """GM manually triggers an inject regardless of schedule."""
        inject = self._injects.get(inject_id)
        if not inject:
            return None
        if inject.lifecycle in {InjectLifecycle.COMPLETED, InjectLifecycle.CANCELLED}:
            return None
        # GM override — bypass normal transition rules
        inject.lifecycle = InjectLifecycle.RUNNING
        inject.started_at_pt_ms = current_pt_ms
        return self._change(inject, "force_triggered")

    def cancel_inject(self, inject_id: str) -> dict | None:
        """GM cancels an inject."""
        inject = self._injects.get(inject_id)
        if not inject:
            return None
        if inject.lifecycle in {InjectLifecycle.COMPLETED, InjectLifecycle.CANCELLED}:
            return None
        self._transition(inject, InjectLifecycle.CANCELLED)
        return self._change(inject, "cancelled")

    def complete_inject(self, inject_id: str, current_pt_ms: float) -> dict | None:
        """GM manually completes a running inject."""
        inject = self._injects.get(inject_id)
        if not inject or inject.lifecycle != InjectLifecycle.RUNNING:
            return None
        self._transition(inject, InjectLifecycle.COMPLETED)
        inject.completed_at_pt_ms = current_pt_ms
        return self._change(inject, "completed")

    def pause_inject(self, inject_id: str) -> dict | None:
        """GM pauses a running inject. Preserves elapsed time."""
        inject = self._injects.get(inject_id)
        if not inject or inject.lifecycle != InjectLifecycle.RUNNING:
            return None
        self._transition(inject, InjectLifecycle.PAUSED)
        return self._change(inject, "paused")

    def resume_inject(
        self, inject_id: str, current_pt_ms: float,
    ) -> dict | None:
        """GM resumes a paused inject. Adjusts started_at to preserve elapsed."""
        inject = self._injects.get(inject_id)
        if not inject or inject.lifecycle != InjectLifecycle.PAUSED:
            return None
        self._transition(inject, InjectLifecycle.RUNNING)
        return self._change(inject, "resumed")

    def delay_inject(
        self, inject_id: str, delay_ms: float,
    ) -> dict | None:
        """GM delays a scheduled inject by adding to its scheduled time."""
        inject = self._injects.get(inject_id)
        if not inject or inject.lifecycle != InjectLifecycle.SCHEDULED:
            return None
        inject.scheduled_pt_ms += delay_ms
        return self._change(inject, "delayed")

    def skip_inject(self, inject_id: str) -> dict | None:
        """GM skips (cancels) a scheduled/pending inject."""
        inject = self._injects.get(inject_id)
        if not inject:
            return None
        if inject.lifecycle in {InjectLifecycle.COMPLETED, InjectLifecycle.CANCELLED}:
            return None
        self._transition(inject, InjectLifecycle.CANCELLED)
        return self._change(inject, "skipped")

    def get_triggered_defects(self, inject_id: str) -> list[str]:
        """Get defect IDs triggered by a completed inject."""
        inject = self._injects.get(inject_id)
        if not inject:
            return []
        return inject.triggered_defects

    def _should_activate(
        self, inject: ScheduledInject, current_pt_ms: float,
    ) -> bool:
        """Check if inject should transition from scheduled to pending."""
        if inject.execution_mode == ExecutionMode.MANUAL:
            return False
        if current_pt_ms < inject.scheduled_pt_ms:
            return False
        # Check dependencies are completed
        for dep_id in inject.dependencies:
            dep = self._injects.get(dep_id)
            if not dep or dep.lifecycle != InjectLifecycle.COMPLETED:
                return False
        return True

    @staticmethod
    def _transition(inject: ScheduledInject, target: InjectLifecycle) -> None:
        allowed = VALID_TRANSITIONS.get(inject.lifecycle, set())
        if target not in allowed:
            return
        inject.lifecycle = target

    @staticmethod
    def _change(inject: ScheduledInject, action: str) -> InjectChange:
        return {
            "type": "inject_change",
            "inject_id": inject.id,
            "action": action,
            "lifecycle": inject.lifecycle.value,
            "title": inject.title,
        }

    def snapshot(self) -> list[dict]:
        """Return all injects as serializable dicts."""
        return [
            {
                "id": e.id,
                "title": e.title,
                "description": e.description,
                "inject_type": e.inject_type.value,
                "scheduled_pt_ms": e.scheduled_pt_ms,
                "duration_ms": e.duration_ms,
                "dependencies": e.dependencies,
                "triggered_defects": e.triggered_defects,
                "execution_mode": e.execution_mode.value,
                "lifecycle": e.lifecycle.value,
                "started_at_pt_ms": e.started_at_pt_ms,
                "completed_at_pt_ms": e.completed_at_pt_ms,
            }
            for e in self._injects.values()
        ]
