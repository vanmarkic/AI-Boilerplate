"""Real time and real identifiers.

The production counterparts of the deterministic adapters used in tests. Both
sit behind ports for exactly that reason: a use case never reads the wall clock
or generates an id directly, so its behaviour is reproducible.
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4


class SystemClockAdapter:
    """The wall clock, always in UTC."""

    def now(self) -> datetime:
        """Return the current instant."""
        return datetime.now(UTC)


class UuidIdAdapter:
    """Random identifiers."""

    def new_id(self) -> UUID:
        """Return a new unique identifier."""
        return uuid4()
