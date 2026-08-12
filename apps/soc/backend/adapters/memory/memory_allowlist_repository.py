"""In-memory allowlist storage."""

from datetime import datetime
from uuid import UUID

from domain.indicator_entity import AllowlistEntry


class MemoryAllowlistRepository:
    """Keys allowlist entries by id."""

    def __init__(self) -> None:
        self._entries: dict[UUID, AllowlistEntry] = {}

    async def list_active(self, now: datetime) -> tuple[AllowlistEntry, ...]:
        """Return entries that have not expired.

        Expressed as a storage predicate rather than by calling
        ``domain.allowlist_policy``: a relational implementation has to push
        this into a WHERE clause, so the port's contract test — not a shared
        function — is what keeps the two honest.
        """
        return tuple(
            e for e in self._entries.values() if e.expires_at is None or e.expires_at > now
        )

    async def add(self, entry: AllowlistEntry) -> AllowlistEntry:
        """Add an entry."""
        self._entries[entry.entry_id] = entry
        return entry

    async def remove(self, entry_id: UUID) -> bool:
        """Remove an entry; False if it was not there."""
        return self._entries.pop(entry_id, None) is not None
