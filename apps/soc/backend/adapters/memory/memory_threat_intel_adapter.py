"""In-memory threat intelligence.

Production-selectable, not merely a test double: with
``SOC_THREAT_INTEL_PROVIDER=memory`` the platform runs its full triage pipeline
with no intel platform deployed at all.
"""

from collections.abc import Mapping, Sequence
from datetime import datetime

from domain.indicator_entity import IndicatorIntel
from domain.observable_entity import Observable

SOURCE_NAME = "memory"


class MemoryThreatIntelAdapter:
    """Serves threat intel from an in-process table."""

    def __init__(self, seed: Sequence[IndicatorIntel] = ()) -> None:
        self._intel: dict[Observable, IndicatorIntel] = {item.observable: item for item in seed}
        self._sightings: list[tuple[Observable, datetime]] = []

    @property
    def published_sightings(self) -> tuple[tuple[Observable, datetime], ...]:
        """Sightings published so far, so tests can assert on them."""
        return tuple(self._sightings)

    async def lookup(self, observable: Observable) -> IndicatorIntel | None:
        """Return seeded intel for an observable, or None."""
        return self._intel.get(observable)

    async def bulk_lookup(
        self,
        observables: Sequence[Observable],
    ) -> Mapping[Observable, IndicatorIntel]:
        """Return intel for the observables we know, omitting the rest."""
        return {o: self._intel[o] for o in observables if o in self._intel}

    async def pull_since(
        self,
        since: datetime,
        *,
        limit: int = 500,
    ) -> tuple[IndicatorIntel, ...]:
        """Return intel last seen at or after the watermark."""
        fresh = [
            item
            for item in self._intel.values()
            if item.last_seen is not None and item.last_seen >= since
        ]
        fresh.sort(key=lambda item: (item.last_seen or since, str(item.observable)))
        return tuple(fresh[:limit])

    async def publish_sighting(self, observable: Observable, observed_at: datetime) -> None:
        """Record that we saw an observable locally."""
        self._sightings.append((observable, observed_at))
