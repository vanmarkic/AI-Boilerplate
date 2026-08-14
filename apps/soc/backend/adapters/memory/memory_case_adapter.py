"""In-memory case management.

Production-selectable: with ``CASE_PROVIDER=memory`` the platform opens and
tracks cases with no external case manager deployed.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field
from itertools import count

from domain.case_entity import (
    TERMINAL_STATUSES,
    CaseDraft,
    CaseNote,
    CaseRef,
    CaseStatus,
    ExternalCaseSnapshot,
)
from domain.observable_entity import Observable
from domain.soc_error import UnknownEntityError

SYSTEM_NAME = "memory"


@dataclass
class _StoredCase:
    """One case held in process."""

    draft: CaseDraft
    status: CaseStatus
    notes: list[CaseNote] = field(default_factory=list)
    observables: list[Observable] = field(default_factory=list)


class MemoryCaseAdapter:
    """Tracks cases in an in-process table."""

    def __init__(self) -> None:
        self._cases: dict[str, _StoredCase] = {}
        self._ids = count(1)

    def _require(self, ref: CaseRef) -> _StoredCase:
        """Return the stored case for a ref, or raise if it is unknown."""
        stored = self._cases.get(ref.external_id)
        if stored is None:
            raise UnknownEntityError(f"unknown case {ref.external_id}")
        return stored

    def notes_for(self, ref: CaseRef) -> tuple[CaseNote, ...]:
        """Return the notes recorded on a case, so tests can assert on them."""
        return tuple(self._require(ref).notes)

    def observables_for(self, ref: CaseRef) -> tuple[Observable, ...]:
        """Return the observables attached to a case."""
        return tuple(self._require(ref).observables)

    async def open_case(self, draft: CaseDraft) -> CaseRef:
        """Open a case and return its handle."""
        external_id = str(next(self._ids))
        self._cases[external_id] = _StoredCase(draft=draft, status=CaseStatus.OPEN)
        return CaseRef(
            system=SYSTEM_NAME,
            external_id=external_id,
            url=f"memory://cases/{external_id}",
        )

    async def find_open_by_correlation(self, correlation_key: str) -> CaseRef | None:
        """Return the open case for a correlation key, if any."""
        for external_id, stored in self._cases.items():
            if stored.draft.correlation_key != correlation_key:
                continue
            if stored.status in TERMINAL_STATUSES:
                continue
            return CaseRef(
                system=SYSTEM_NAME,
                external_id=external_id,
                url=f"memory://cases/{external_id}",
            )
        return None

    async def add_note(self, ref: CaseRef, note: CaseNote) -> None:
        """Append a note."""
        self._require(ref).notes.append(note)

    async def attach_observables(self, ref: CaseRef, observables: Sequence[Observable]) -> None:
        """Attach observables, skipping ones already present."""
        stored = self._require(ref)
        for observable in observables:
            if observable not in stored.observables:
                stored.observables.append(observable)

    async def transition(self, ref: CaseRef, status: CaseStatus) -> None:
        """Move a case to a new status."""
        self._require(ref).status = status

    async def fetch_case(self, ref: CaseRef) -> ExternalCaseSnapshot | None:
        """Return the current snapshot, or None if the case is unknown."""
        stored = self._cases.get(ref.external_id)
        if stored is None:
            return None
        return ExternalCaseSnapshot(ref=ref, status=stored.status)
