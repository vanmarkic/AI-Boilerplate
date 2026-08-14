"""Repository port for playbook runs.

``find_by_idempotency_key`` is the whole idempotency guarantee: orchestrators
do not offer one, so the core enforces it here, backed by a unique constraint.
Without this lookup, a retried event fires containment twice.
"""

from typing import Protocol, runtime_checkable
from uuid import UUID

from domain.playbook_entity import PlaybookRun


@runtime_checkable
class PlaybookRunRepositoryPort(Protocol):
    """Persistence for response actions."""

    async def save(self, run: PlaybookRun) -> PlaybookRun:
        """Insert or update a run by id."""
        ...

    async def get(self, run_id: UUID) -> PlaybookRun | None:
        """Return a run, or None."""
        ...

    async def find_by_idempotency_key(self, key: str) -> PlaybookRun | None:
        """Return the run already recorded for an intended action, if any."""
        ...

    async def list_for_case(self, case_id: UUID) -> tuple[PlaybookRun, ...]:
        """Return every run associated with a case."""
        ...
