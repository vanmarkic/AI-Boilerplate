"""Repository port for indicators and sightings — state the core owns.

Kept separate from ``ThreatIntelPort`` on purpose: that one is what a *source*
claims, this one is what *we* have decided. The split is what lets the intel
platform be swapped without losing our own record.
"""

from collections.abc import Sequence
from datetime import datetime
from typing import Protocol, runtime_checkable
from uuid import UUID

from domain.indicator_entity import Indicator, IndicatorStatus, Sighting
from domain.observable_entity import Observable


@runtime_checkable
class IndicatorRepositoryPort(Protocol):
    """Persistence for the indicators this platform owns."""

    async def get_by_observable(self, observable: Observable) -> Indicator | None:
        """Return the indicator for an observable, or None."""
        ...

    async def get_many(self, observables: Sequence[Observable]) -> tuple[Indicator, ...]:
        """Return the indicators we hold for these observables, omitting misses."""
        ...

    async def upsert(self, indicator: Indicator) -> Indicator:
        """Insert or update by observable, never duplicating one."""
        ...

    async def list_by_status(
        self,
        status: IndicatorStatus,
        *,
        limit: int,
        offset: int = 0,
    ) -> tuple[Indicator, ...]:
        """Return a page of indicators in a given lifecycle state."""
        ...

    async def list_stale(
        self,
        last_seen_before: datetime,
        *,
        limit: int,
    ) -> tuple[Indicator, ...]:
        """Return indicators not seen since an instant, for decay sweeps."""
        ...

    async def record_sighting(self, sighting: Sighting) -> Sighting:
        """Record that we observed an indicator in our own telemetry."""
        ...

    async def count_sightings(self, indicator_id: UUID) -> int:
        """Return how many times we have seen an indicator."""
        ...
