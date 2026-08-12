"""In-memory allowlist storage."""

from datetime import datetime
from uuid import UUID

from adapters.memory.memory_store import MemoryStore
from domain.indicator_entity import AllowlistEntry


class MemoryAllowlistRepository:
    """Keys allowlist entries by id."""

    def __init__(self, store: MemoryStore) -> None:
        self._store = store

    async def list_active(self, now: datetime) -> tuple[AllowlistEntry, ...]:
        """Return entries that have not expired.

        Expressed as a storage predicate rather than by calling
        ``domain.allowlist_policy``: a relational implementation has to push
        this into a WHERE clause, so the port's contract test — not a shared
        function — is what keeps the two honest.
        """
        return tuple(
            e for e in self._store.allowlist.values() if e.expires_at is None or e.expires_at > now
        )

    async def add(self, entry: AllowlistEntry) -> AllowlistEntry:
        """Add an entry."""
        self._store.allowlist[entry.entry_id] = entry
        return entry

    async def remove(self, entry_id: UUID) -> bool:
        """Remove an entry; False if it was not there."""
        return self._store.allowlist.pop(entry_id, None) is not None
