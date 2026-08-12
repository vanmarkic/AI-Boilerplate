"""Ports for the two ambient dependencies that would otherwise break determinism.

Time and identity are injected rather than read from the environment, so a
use-case test can assert on exact timestamps and exact ids instead of
approximations.
"""

from datetime import datetime
from typing import Protocol, runtime_checkable
from uuid import UUID


@runtime_checkable
class ClockPort(Protocol):
    """The current time, always timezone-aware UTC."""

    def now(self) -> datetime:
        """Return the current instant."""
        ...


@runtime_checkable
class IdGeneratorPort(Protocol):
    """Fresh identifiers for entities the core creates."""

    def new_id(self) -> UUID:
        """Return a new unique identifier."""
        ...
