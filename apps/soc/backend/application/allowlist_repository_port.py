"""Repository port for allowlist entries."""

from datetime import datetime
from typing import Protocol, runtime_checkable
from uuid import UUID

from domain.indicator_entity import AllowlistEntry


@runtime_checkable
class AllowlistRepositoryPort(Protocol):
    """Persistence for suppression rules."""

    async def list_active(self, now: datetime) -> tuple[AllowlistEntry, ...]:
        """Return entries that have not expired as of an instant."""
        ...

    async def add(self, entry: AllowlistEntry) -> AllowlistEntry:
        """Add an entry."""
        ...

    async def remove(self, entry_id: UUID) -> bool:
        """Remove an entry; return False if it was not there."""
        ...
