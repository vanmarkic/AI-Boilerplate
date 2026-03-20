"""Manages ship system states (power on/off + operational traffic-light).

Domain term: "system" / "weapon". Each system has a power toggle (on/off)
and an operational state (green/yellow/red).
"""

from __future__ import annotations

from dataclasses import dataclass

from engine.state_changes import SystemSnapshot, SystemStateChange

OPERATIONAL_ORDER = ["red", "yellow", "green"]


@dataclass
class SystemState:
    system_id: str
    label: str = ""
    category: str = "system"  # "system" | "weapon"
    power: bool = False
    operational: str = "green"


class SystemManager:
    """Manages ship system states (power on/off + operational traffic-light)."""

    def __init__(self) -> None:
        self._systems: dict[str, SystemState] = {}

    def load_systems(self, systems: list[SystemState]) -> None:
        self._systems = {s.system_id: s for s in systems}

    @property
    def systems(self) -> dict[str, SystemState]:
        return self._systems

    def set_power(self, system_id: str, on: bool) -> SystemStateChange | None:
        """Return SystemStateChange dict or None if no change."""
        s = self._systems.get(system_id)
        if s is None or s.power == on:
            return None
        s.power = on
        return self._change(s, "power_changed")

    def set_operational(self, system_id: str, state: str) -> SystemStateChange | None:
        """Return SystemStateChange dict or None if no change."""
        if state not in OPERATIONAL_ORDER:
            return None
        s = self._systems.get(system_id)
        if s is None or s.operational == state:
            return None
        s.operational = state
        return self._change(s, "operational_changed")

    def increment_operational(self, system_id: str) -> SystemStateChange | None:
        """red -> yellow -> green. Returns None if already green or unknown system."""
        s = self._systems.get(system_id)
        if s is None:
            return None
        try:
            idx = OPERATIONAL_ORDER.index(s.operational)
        except ValueError:
            return None
        if idx >= len(OPERATIONAL_ORDER) - 1:
            return None  # already green
        s.operational = OPERATIONAL_ORDER[idx + 1]
        return self._change(s, "operational_changed")

    def set_all_power(self, on: bool) -> list[SystemStateChange]:
        """General Quarters: all systems ON. Returns list of changes."""
        changes: list[SystemStateChange] = []
        for s in self._systems.values():
            if s.power != on:
                s.power = on
                changes.append(self._change(s, "power_changed"))
        return changes

    def snapshot(self) -> list[SystemSnapshot]:
        """Return list of system state dicts for all systems."""
        return [
            SystemSnapshot(
                system_id=s.system_id,
                label=s.label,
                category=s.category,
                power=s.power,
                operational=s.operational,
            )
            for s in self._systems.values()
        ]

    @staticmethod
    def _change(s: SystemState, action: str) -> SystemStateChange:
        return SystemStateChange(
            type="system_state_change",
            system_id=s.system_id,
            action=action,
            power=s.power,
            operational=s.operational,
        )
