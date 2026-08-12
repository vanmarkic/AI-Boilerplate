"""Deterministic time and identity.

Used by tests and by the in-memory profile. Because these are ports like any
other, a use case can assert on exact timestamps and exact ids rather than
tolerating whatever the wall clock happened to say.
"""

from datetime import datetime, timedelta
from itertools import count
from uuid import UUID


class FixedClockAdapter:
    """A clock that stands still until explicitly advanced."""

    def __init__(self, start: datetime) -> None:
        self._now = start

    def now(self) -> datetime:
        """Return the current fixed instant."""
        return self._now

    def advance(self, delta: timedelta) -> datetime:
        """Move the clock forward and return the new instant."""
        self._now = self._now + delta
        return self._now


class SequentialIdAdapter:
    """Identifiers that are predictable, so tests can name them."""

    def __init__(self, start: int = 1) -> None:
        self._counter = count(start)

    def new_id(self) -> UUID:
        """Return the next identifier in sequence."""
        return UUID(int=next(self._counter))
