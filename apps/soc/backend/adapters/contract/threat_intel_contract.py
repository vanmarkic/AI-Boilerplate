"""Behaviour every ThreatIntelPort implementation must exhibit.

This is the swappability proof: the in-memory adapter and every real vendor
adapter subclass this and must pass identically. A new intel platform is
"done" when this suite is green against it — nothing else changes.

Not named ``Test*``, so pytest never collects the base class itself.
"""

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

import pytest

from application.threat_intel_port import ThreatIntelPort
from domain.indicator_entity import CONFIDENCE_MAX, CONFIDENCE_MIN
from domain.observable_entity import Observable, ObservableType

UNKNOWN = Observable(ObservableType.IPV4, "198.51.100.222")


class ThreatIntelContract:
    """Subclass this and supply ``port`` and ``known``."""

    @pytest.fixture
    def port(self) -> ThreatIntelPort:
        """The implementation under test."""
        raise NotImplementedError

    @pytest.fixture
    def known(self) -> Observable:
        """An observable the implementation has intel for."""
        raise NotImplementedError

    @pytest.fixture
    def seeded_at(self) -> datetime:
        """An instant before the implementation's intel was recorded."""
        return datetime(2020, 1, 1, tzinfo=UTC)

    async def test_satisfies_the_port(self, port: ThreatIntelPort) -> None:
        assert isinstance(port, ThreatIntelPort)

    async def test_unknown_observable_returns_none(self, port: ThreatIntelPort) -> None:
        """A miss is an answer, not an error."""
        assert await port.lookup(UNKNOWN) is None

    async def test_known_observable_returns_intel_for_itself(
        self, port: ThreatIntelPort, known: Observable
    ) -> None:
        intel = await port.lookup(known)
        assert intel is not None
        assert intel.observable == known
        assert intel.known

    async def test_confidence_is_within_bounds(
        self, port: ThreatIntelPort, known: Observable
    ) -> None:
        intel = await port.lookup(known)
        assert intel is not None
        assert CONFIDENCE_MIN <= intel.confidence.value <= CONFIDENCE_MAX

    async def test_intel_declares_its_source(
        self, port: ThreatIntelPort, known: Observable
    ) -> None:
        intel = await port.lookup(known)
        assert intel is not None
        assert intel.source

    async def test_bulk_lookup_agrees_with_single_lookup(
        self, port: ThreatIntelPort, known: Observable
    ) -> None:
        single = await port.lookup(known)
        bulk = await port.bulk_lookup([known])
        assert bulk[known] == single

    async def test_bulk_lookup_omits_unknown_observables(
        self, port: ThreatIntelPort, known: Observable
    ) -> None:
        """Absent keys, not None values: callers should not have to filter."""
        bulk = await port.bulk_lookup([known, UNKNOWN])
        assert UNKNOWN not in bulk
        assert known in bulk

    async def test_bulk_lookup_of_nothing_returns_nothing(self, port: ThreatIntelPort) -> None:
        assert await port.bulk_lookup([]) == {}

    async def test_pull_since_returns_intel_recorded_after_the_watermark(
        self, port: ThreatIntelPort, known: Observable, seeded_at: datetime
    ) -> None:
        pulled: Sequence[object] = await port.pull_since(seeded_at)
        assert any(getattr(item, "observable", None) == known for item in pulled)

    async def test_pull_since_respects_a_future_watermark(self, port: ThreatIntelPort) -> None:
        future = datetime.now(UTC) + timedelta(days=3650)
        assert await port.pull_since(future) == ()

    async def test_pull_since_honours_the_limit(
        self, port: ThreatIntelPort, seeded_at: datetime
    ) -> None:
        assert len(await port.pull_since(seeded_at, limit=1)) <= 1

    async def test_publishing_a_sighting_is_accepted(
        self, port: ThreatIntelPort, known: Observable
    ) -> None:
        """Publishing must not raise for an observable the source knows."""
        await port.publish_sighting(known, datetime.now(UTC))
