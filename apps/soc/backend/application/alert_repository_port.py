"""Repository port for alerts."""

from typing import Protocol, runtime_checkable
from uuid import UUID

from domain.verdict_entity import Alert


@runtime_checkable
class AlertRepositoryPort(Protocol):
    """Persistence for actionable findings."""

    async def save(self, alert: Alert) -> Alert:
        """Insert or update an alert by id."""
        ...

    async def get(self, alert_id: UUID) -> Alert | None:
        """Return an alert, or None."""
        ...

    async def find_by_dedup_key(self, dedup_key: str) -> Alert | None:
        """Return the alert already raised for an event, if any.

        This is what stops a replayed event from raising a second alert.
        """
        ...

    async def list_recent(self, *, limit: int, offset: int = 0) -> tuple[Alert, ...]:
        """Return a page of alerts, newest first."""
        ...
