"""Manages warfare domain threat levels (green/yellow/red).

Domain term: "warfare domain". Each domain tracks threat level:
green = no threat, yellow = possible threat, red = actual threat.
Semantically separate from system operational states.
"""

from __future__ import annotations

from dataclasses import dataclass

from engine.state_changes import WarfareDomainChange, WarfareDomainSnapshot

THREAT_LEVELS = {"green", "yellow", "red"}


@dataclass
class WarfareDomainState:
    domain_id: str
    label: str = ""
    threat_level: str = "green"


class WarfareDomainManager:
    """Manages warfare domain threat levels."""

    def __init__(self) -> None:
        self._domains: dict[str, WarfareDomainState] = {}

    def load_domains(self, domains: list[WarfareDomainState]) -> None:
        self._domains = {d.domain_id: d for d in domains}

    @property
    def domains(self) -> dict[str, WarfareDomainState]:
        return self._domains

    def set_threat_level(self, domain_id: str, level: str) -> WarfareDomainChange | None:
        """Return WarfareDomainChange dict or None if no change."""
        if level not in THREAT_LEVELS:
            return None
        d = self._domains.get(domain_id)
        if d is None or d.threat_level == level:
            return None
        d.threat_level = level
        return WarfareDomainChange(
            type="warfare_domain_change",
            domain_id=d.domain_id,
            threat_level=d.threat_level,
        )

    def snapshot(self) -> list[WarfareDomainSnapshot]:
        """Return list of warfare domain state dicts for all domains."""
        return [
            WarfareDomainSnapshot(
                domain_id=d.domain_id,
                label=d.label,
                threat_level=d.threat_level,
            )
            for d in self._domains.values()
        ]
