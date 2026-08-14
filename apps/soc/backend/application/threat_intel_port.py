"""Outbound port for external threat intelligence.

Phrased entirely in domain language: nothing in this signature reveals which
platform is behind it. Swapping intel providers means writing one adapter that
satisfies this Protocol and passing the shared contract suite.
"""

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Protocol, runtime_checkable

from domain.indicator_entity import IndicatorIntel
from domain.observable_entity import Observable


@runtime_checkable
class ThreatIntelPort(Protocol):
    """What the core needs from any threat-intelligence source."""

    async def lookup(self, observable: Observable) -> IndicatorIntel | None:
        """Return what the source knows, or None if it knows nothing.

        A miss is an answer. Implementations must not raise for an unknown
        observable — only for genuine integration failures.
        """
        ...

    async def bulk_lookup(
        self,
        observables: Sequence[Observable],
    ) -> Mapping[Observable, IndicatorIntel]:
        """Look up many observables at once.

        Unknown observables are absent from the result rather than mapped to
        None, so callers never have to filter.
        """
        ...

    async def pull_since(
        self,
        since: datetime,
        *,
        limit: int = 500,
    ) -> tuple[IndicatorIntel, ...]:
        """Return intel recorded at or after a watermark, newest-safe.

        Used to sync the source into our own indicator store. Implementations
        own their pagination; callers only see the flattened result.
        """
        ...

    async def publish_sighting(self, observable: Observable, observed_at: datetime) -> None:
        """Tell the source we saw this observable in our own telemetry.

        Best-effort by contract: the core treats intel as a source *and* sink,
        but never depends on the publish succeeding to complete triage.
        """
        ...
