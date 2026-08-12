"""MISP as a ThreatIntelPort.

Thin by design: the transport is in ``misp_client`` and the vocabulary
translation in ``misp_mapper``, leaving this file to satisfy the port and
nothing else.
"""

from collections.abc import Mapping, Sequence
from datetime import datetime

from adapters.misp.misp_client import MispClient
from adapters.misp.misp_mapper import to_indicator_intel
from domain.indicator_entity import IndicatorIntel
from domain.observable_entity import Observable


class MispThreatIntelAdapter:
    """Serves threat intel from a MISP instance."""

    def __init__(self, client: MispClient) -> None:
        self._client = client

    async def aclose(self) -> None:
        """Release the underlying connection pool."""
        await self._client.aclose()

    async def lookup(self, observable: Observable) -> IndicatorIntel | None:
        """Return what MISP knows about one observable, or None."""
        found = await self.bulk_lookup([observable])
        return found.get(observable)

    async def bulk_lookup(
        self,
        observables: Sequence[Observable],
    ) -> Mapping[Observable, IndicatorIntel]:
        """Return intel for the observables MISP knows, omitting the rest.

        Where MISP holds several attributes for one artefact, the most
        confident wins: an indicator is only as good as its best evidence.
        """
        if not observables:
            return {}

        wanted = {o.value: o for o in observables}
        attributes = await self._client.search_values(list(wanted), limit=len(wanted) * 10)

        best: dict[Observable, IndicatorIntel] = {}
        for attribute in attributes:
            intel = to_indicator_intel(attribute)
            if intel is None or intel.observable not in wanted.values():
                continue
            current = best.get(intel.observable)
            if current is None or intel.confidence.value > current.confidence.value:
                best[intel.observable] = intel
        return best

    async def pull_since(
        self,
        since: datetime,
        *,
        limit: int = 500,
    ) -> tuple[IndicatorIntel, ...]:
        """Return intel MISP recorded at or after a watermark."""
        attributes = await self._client.search_since(since, limit=limit)
        pulled = [to_indicator_intel(a) for a in attributes]
        fresh = [
            intel
            for intel in pulled
            if intel is not None and (intel.last_seen is None or intel.last_seen >= since)
        ]
        return tuple(fresh[:limit])

    async def publish_sighting(self, observable: Observable, observed_at: datetime) -> None:
        """Tell MISP we saw this observable in our own telemetry."""
        await self._client.add_sighting(observable.value, observed_at)
