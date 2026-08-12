"""Outbound port for the external case management system.

The core owns its own ``Case``; this port only mirrors it outward. A
``CaseRef`` is an opaque (system, external_id) handle that the core never
interprets, which is what lets one case manager be swapped for another.
"""

from collections.abc import Sequence
from typing import Protocol, runtime_checkable

from domain.case_entity import (
    CaseDraft,
    CaseNote,
    CaseRef,
    CaseStatus,
    ExternalCaseSnapshot,
)
from domain.observable_entity import Observable


@runtime_checkable
class CaseManagementPort(Protocol):
    """What the core needs from any case management system."""

    async def open_case(self, draft: CaseDraft) -> CaseRef:
        """Open a case and return a handle to it."""
        ...

    async def find_open_by_correlation(self, correlation_key: str) -> CaseRef | None:
        """Return the open case carrying this correlation key, if any.

        Closed cases must not be returned: a recurrence after closure is a new
        investigation, not a reopening.
        """
        ...

    async def add_note(self, ref: CaseRef, note: CaseNote) -> None:
        """Append a note to a case."""
        ...

    async def attach_observables(self, ref: CaseRef, observables: Sequence[Observable]) -> None:
        """Attach observables to a case as indicators of compromise."""
        ...

    async def transition(self, ref: CaseRef, status: CaseStatus) -> None:
        """Move a case to a new status.

        Legality is decided by ``domain.case_policy`` before this is called;
        the port only carries the decision outward.
        """
        ...

    async def fetch_case(self, ref: CaseRef) -> ExternalCaseSnapshot | None:
        """Return what the external system currently believes, or None."""
        ...
