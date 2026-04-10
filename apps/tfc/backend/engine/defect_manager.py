"""Manages defect lifecycle with activation triggers and auto-resolve countdowns.

Defects progress through: inactive -> active -> mitigated -> resolved.
Trigger modes: time-based, inject-based, manual (GM).
ETBOL countdowns: auto_resolve_pt_ms (play time) and/or auto_resolve_rt_ms (real
time). The defect resolves on whichever countdown expires first.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

from engine.state_changes import DefectChange


class DefectLifecycle(StrEnum):
    INACTIVE = "inactive"
    ACTIVE = "active"
    MITIGATED = "mitigated"
    RESOLVED = "resolved"


class TriggerMode(StrEnum):
    TIME_BASED = "time-based"
    INJECT_BASED = "inject-based"
    MANUAL = "manual"


VALID_TRANSITIONS: dict[DefectLifecycle, set[DefectLifecycle]] = {
    DefectLifecycle.INACTIVE: {DefectLifecycle.ACTIVE},
    DefectLifecycle.ACTIVE: {DefectLifecycle.MITIGATED, DefectLifecycle.RESOLVED},
    DefectLifecycle.MITIGATED: {DefectLifecycle.RESOLVED},
    DefectLifecycle.RESOLVED: set(),
}


@dataclass
class TrackedDefect:
    """Runtime representation of a defect during exercise execution."""
    id: str
    title: str
    description: str
    trigger_mode: TriggerMode
    trigger_time_pt_ms: float | None = None
    trigger_inject_id: str | None = None
    auto_resolve_pt_ms: float = 0.0
    auto_resolve_rt_ms: float = 0.0
    lifecycle: DefectLifecycle = DefectLifecycle.INACTIVE
    activated_at_pt_ms: float | None = None
    activated_at_rt_ms: float | None = None
    resolved_at_pt_ms: float | None = None
    released_to_players: bool = False


class DefectManager:
    """Manages defect activation, auto-resolve countdowns, and lifecycle."""

    def __init__(self) -> None:
        self._defects: dict[str, TrackedDefect] = {}

    @property
    def defects(self) -> dict[str, TrackedDefect]:
        return self._defects

    def load_defects(self, defects: list[TrackedDefect]) -> None:
        self._defects = {i.id: i for i in defects}

    def clear(self) -> None:
        self._defects.clear()

    def tick(
        self,
        current_pt_ms: float,
        completed_inject_ids: set[str],
        *,
        current_rt_ms: float = 0.0,
    ) -> list[dict]:
        """Check all defects for activation and auto-resolve expiry.

        Args:
            current_pt_ms: Current play time in milliseconds.
            completed_inject_ids: Set of inject IDs that have completed.
            current_rt_ms: Current real time in milliseconds (for RT countdown).

        Returns:
            List of state change dicts for broadcasting.
        """
        changes: list[dict] = []

        for defect in self._defects.values():
            if defect.lifecycle == DefectLifecycle.INACTIVE:
                if self._should_activate(defect, current_pt_ms, completed_inject_ids):
                    self._activate(defect, current_pt_ms, current_rt_ms)
                    changes.append(self._change(defect, "activated"))

            if defect.lifecycle == DefectLifecycle.ACTIVE:
                resolved = False

                # PT countdown
                if not resolved and defect.auto_resolve_pt_ms > 0:
                    if defect.activated_at_pt_ms is not None:
                        if (current_pt_ms - defect.activated_at_pt_ms) >= defect.auto_resolve_pt_ms:
                            resolved = True

                # RT countdown
                if not resolved and defect.auto_resolve_rt_ms > 0:
                    if defect.activated_at_rt_ms is not None:
                        if (current_rt_ms - defect.activated_at_rt_ms) >= defect.auto_resolve_rt_ms:
                            resolved = True

                if resolved:
                    self._transition(defect, DefectLifecycle.RESOLVED)
                    defect.resolved_at_pt_ms = current_pt_ms
                    changes.append(self._change(defect, "auto_resolve_expired"))

        return changes

    def activate_by_inject(
        self, inject_id: str, current_pt_ms: float,
    ) -> list[dict]:
        """Activate all defects triggered by a specific inject."""
        changes: list[dict] = []
        for defect in self._defects.values():
            if (
                defect.lifecycle == DefectLifecycle.INACTIVE
                and defect.trigger_mode == TriggerMode.INJECT_BASED
                and defect.trigger_inject_id == inject_id
            ):
                self._activate(defect, current_pt_ms)
                changes.append(self._change(defect, "activated"))
        return changes

    def manual_activate(
        self, defect_id: str, current_pt_ms: float,
    ) -> dict | None:
        """GM manually activates a defect."""
        defect = self._defects.get(defect_id)
        if not defect or defect.lifecycle != DefectLifecycle.INACTIVE:
            return None
        self._activate(defect, current_pt_ms)
        return self._change(defect, "manual_activated")

    def mitigate(self, defect_id: str) -> dict | None:
        """Transition defect to mitigated state."""
        defect = self._defects.get(defect_id)
        if not defect or defect.lifecycle != DefectLifecycle.ACTIVE:
            return None
        self._transition(defect, DefectLifecycle.MITIGATED)
        return self._change(defect, "mitigated")

    def resolve(
        self, defect_id: str, current_pt_ms: float,
    ) -> dict | None:
        """Resolve an active or mitigated defect."""
        defect = self._defects.get(defect_id)
        if not defect:
            return None
        if defect.lifecycle not in {DefectLifecycle.ACTIVE, DefectLifecycle.MITIGATED}:
            return None
        self._transition(defect, DefectLifecycle.RESOLVED)
        defect.resolved_at_pt_ms = current_pt_ms
        return self._change(defect, "resolved")

    def release_to_players(self, defect_id: str) -> dict | None:
        """Mark a defect as visible to players."""
        defect = self._defects.get(defect_id)
        if not defect or defect.lifecycle == DefectLifecycle.INACTIVE:
            return None
        defect.released_to_players = True
        return self._change(defect, "released")

    def _should_activate(
        self,
        defect: TrackedDefect,
        current_pt_ms: float,
        completed_inject_ids: set[str],
    ) -> bool:
        if defect.trigger_mode == TriggerMode.TIME_BASED:
            return (
                defect.trigger_time_pt_ms is not None
                and current_pt_ms >= defect.trigger_time_pt_ms
            )
        if defect.trigger_mode == TriggerMode.INJECT_BASED:
            return (
                defect.trigger_inject_id is not None
                and defect.trigger_inject_id in completed_inject_ids
            )
        return False  # manual triggers don't auto-activate

    @staticmethod
    def _activate(
        defect: TrackedDefect, current_pt_ms: float, current_rt_ms: float = 0.0,
    ) -> None:
        defect.lifecycle = DefectLifecycle.ACTIVE
        defect.activated_at_pt_ms = current_pt_ms
        defect.activated_at_rt_ms = current_rt_ms
        defect.released_to_players = True

    @staticmethod
    def _transition(defect: TrackedDefect, target: DefectLifecycle) -> None:
        allowed = VALID_TRANSITIONS.get(defect.lifecycle, set())
        if target not in allowed:
            return
        defect.lifecycle = target

    @staticmethod
    def _change(defect: TrackedDefect, action: str) -> DefectChange:
        return {
            "type": "defect_change",
            "defect_id": defect.id,
            "action": action,
            "lifecycle": defect.lifecycle.value,
            "title": defect.title,
            "released": defect.released_to_players,
        }

    def snapshot(self) -> list[dict]:
        return [
            {
                "id": i.id,
                "title": i.title,
                "description": i.description,
                "trigger_mode": i.trigger_mode.value,
                "auto_resolve_pt_ms": i.auto_resolve_pt_ms,
                "auto_resolve_rt_ms": i.auto_resolve_rt_ms,
                "lifecycle": i.lifecycle.value,
                "activated_at_pt_ms": i.activated_at_pt_ms,
                "resolved_at_pt_ms": i.resolved_at_pt_ms,
                "released": i.released_to_players,
            }
            for i in self._defects.values()
        ]
