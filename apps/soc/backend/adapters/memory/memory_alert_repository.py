"""In-memory alert storage."""

from uuid import UUID

from domain.verdict_entity import Alert


class MemoryAlertRepository:
    """Keys alerts by id, with a secondary index on the dedup key."""

    def __init__(self) -> None:
        self._alerts: dict[UUID, Alert] = {}

    async def save(self, alert: Alert) -> Alert:
        """Insert or replace by id."""
        self._alerts[alert.alert_id] = alert
        return alert

    async def get(self, alert_id: UUID) -> Alert | None:
        """Return an alert, or None."""
        return self._alerts.get(alert_id)

    async def find_by_dedup_key(self, dedup_key: str) -> Alert | None:
        """Return the alert already raised for an event, if any."""
        for alert in self._alerts.values():
            if alert.dedup_key == dedup_key:
                return alert
        return None

    async def list_recent(self, *, limit: int, offset: int = 0) -> tuple[Alert, ...]:
        """Return a page of alerts, newest first."""
        ordered = sorted(
            self._alerts.values(),
            key=lambda a: (a.created_at, str(a.alert_id)),
            reverse=True,
        )
        return tuple(ordered[offset : offset + limit])
