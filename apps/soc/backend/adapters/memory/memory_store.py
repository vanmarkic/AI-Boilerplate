"""The long-lived in-process store the memory repositories read and write.

Extracted deliberately. Previously each memory repository owned its own
dictionary, which meant the repository object *was* the storage — so it had to
be a process-wide singleton, while a SQL repository has to be per-request. That
asymmetry was an accident of the in-memory implementation, not a design.

Separating them mirrors what SQL already does: a long-lived store (engine) and
a short-lived handle onto it (session). Here the store is this object and the
handle is a repository constructed around it, so both providers follow one
rule — the repository is per-request, the storage outlives it.
"""

from dataclasses import dataclass, field
from uuid import UUID

from domain.case_entity import Case
from domain.indicator_entity import AllowlistEntry, Indicator, Sighting
from domain.observable_entity import Observable
from domain.playbook_entity import PlaybookRun
from domain.verdict_entity import Alert


@dataclass(slots=True)
class MemoryStore:
    """Every collection the in-memory repositories persist into.

    Indicators are keyed by observable rather than by id: that is what makes
    ``upsert`` structurally unable to duplicate one, mirroring the
    ``UNIQUE(observable_type, observable_value)`` the relational schema uses.
    """

    indicators: dict[Observable, Indicator] = field(default_factory=dict)
    sightings: list[Sighting] = field(default_factory=list)
    allowlist: dict[UUID, AllowlistEntry] = field(default_factory=dict)
    alerts: dict[UUID, Alert] = field(default_factory=dict)
    cases: dict[UUID, Case] = field(default_factory=dict)
    playbook_runs: dict[UUID, PlaybookRun] = field(default_factory=dict)

    def clear(self) -> None:
        """Drop everything. Gives a test the isolation a fresh database gives."""
        self.indicators.clear()
        self.sightings.clear()
        self.allowlist.clear()
        self.alerts.clear()
        self.cases.clear()
        self.playbook_runs.clear()
