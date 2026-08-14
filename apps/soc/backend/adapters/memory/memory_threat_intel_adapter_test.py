"""The in-memory intel source satisfies the ThreatIntelPort contract."""

from datetime import UTC, datetime

import pytest

from adapters.contract.threat_intel_contract import ThreatIntelContract
from adapters.memory.memory_threat_intel_adapter import MemoryThreatIntelAdapter
from application.threat_intel_port import ThreatIntelPort
from domain.indicator_entity import Confidence, IndicatorIntel, TlpLevel
from domain.observable_entity import Observable, ObservableType

KNOWN = Observable(ObservableType.IPV4, "203.0.113.9")
SEEDED_AT = datetime(2026, 1, 1, tzinfo=UTC)


def seed() -> tuple[IndicatorIntel, ...]:
    """Intel the in-memory source starts with."""
    return (
        IndicatorIntel(
            observable=KNOWN,
            known=True,
            confidence=Confidence(80),
            threat_labels=("c2",),
            tlp=TlpLevel.AMBER,
            first_seen=SEEDED_AT,
            last_seen=SEEDED_AT,
            source="memory",
        ),
    )


class TestMemoryThreatIntel(ThreatIntelContract):
    """Runs the shared contract against the in-memory implementation."""

    @pytest.fixture
    def port(self) -> ThreatIntelPort:
        return MemoryThreatIntelAdapter(seed())

    @pytest.fixture
    def known(self) -> Observable:
        return KNOWN

    @pytest.fixture
    def seeded_at(self) -> datetime:
        return datetime(2025, 1, 1, tzinfo=UTC)


class TestMemoryThreatIntelExtras:
    """Behaviour specific to the in-memory implementation."""

    async def test_recorded_sightings_are_observable(self) -> None:
        """Sightings are readable back, so tests can assert what was published."""
        adapter = MemoryThreatIntelAdapter(seed())
        moment = datetime(2026, 8, 12, tzinfo=UTC)
        await adapter.publish_sighting(KNOWN, moment)
        assert adapter.published_sightings == ((KNOWN, moment),)

    async def test_starts_empty_when_unseeded(self) -> None:
        adapter = MemoryThreatIntelAdapter()
        assert await adapter.lookup(KNOWN) is None
