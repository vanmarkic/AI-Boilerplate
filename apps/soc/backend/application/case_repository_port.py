"""Repository port for cases the core owns.

The local case is saved *before* the external case manager is called, so an
outage over there can never lose the investigation over here.
"""

from typing import Protocol, runtime_checkable
from uuid import UUID

from domain.case_entity import Case


@runtime_checkable
class CaseRepositoryPort(Protocol):
    """Persistence for investigations."""

    async def save(self, case: Case) -> Case:
        """Insert or update a case by id."""
        ...

    async def get(self, case_id: UUID) -> Case | None:
        """Return a case, or None."""
        ...

    async def find_open_by_correlation_key(self, correlation_key: str) -> Case | None:
        """Return the open case for a correlation key, if any.

        Closed cases must not be returned: a recurrence after closure is a new
        investigation.
        """
        ...

    async def list_open(self, *, limit: int, offset: int = 0) -> tuple[Case, ...]:
        """Return a page of open cases."""
        ...
