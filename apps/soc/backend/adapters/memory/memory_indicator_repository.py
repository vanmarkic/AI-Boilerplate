"""In-memory indicator and sighting storage."""

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from domain.indicator_entity import Indicator, IndicatorStatus, Sighting
from domain.observable_entity import Observable


class MemoryIndicatorRepository:
    """Keys indicators by observable, so upsert can never duplicate one."""

    def __init__(self) -> None:
        self._by_observable: dict[Observable, Indicator] = {}
        self._sightings: list[Sighting] = []

    async def get_by_observable(self, observable: Observable) -> Indicator | None:
        """Return the indicator for an observable, or None."""
        return self._by_observable.get(observable)

    async def get_many(self, observables: Sequence[Observable]) -> tuple[Indicator, ...]:
        """Return the indicators we hold for these observables."""
        return tuple(self._by_observable[o] for o in observables if o in self._by_observable)

    async def upsert(self, indicator: Indicator) -> Indicator:
        """Insert or replace by observable."""
        self._by_observable[indicator.observable] = indicator
        return indicator

    async def list_by_status(
        self,
        status: IndicatorStatus,
        *,
        limit: int,
        offset: int = 0,
    ) -> tuple[Indicator, ...]:
        """Return a page of indicators in a lifecycle state."""
        matching = [i for i in self._by_observable.values() if i.status is status]
        matching.sort(key=lambda i: str(i.observable))
        return tuple(matching[offset : offset + limit])

    async def list_stale(
        self,
        last_seen_before: datetime,
        *,
        limit: int,
    ) -> tuple[Indicator, ...]:
        """Return indicators not seen since an instant."""
        stale = [i for i in self._by_observable.values() if i.last_seen < last_seen_before]
        stale.sort(key=lambda i: i.last_seen)
        return tuple(stale[:limit])

    async def record_sighting(self, sighting: Sighting) -> Sighting:
        """Record a local sighting."""
        self._sightings.append(sighting)
        return sighting

    async def count_sightings(self, indicator_id: UUID) -> int:
        """Count sightings for an indicator."""
        return sum(1 for s in self._sightings if s.indicator_id == indicator_id)
