"""Ingesting and triaging an event, driven entirely through in-memory ports."""

from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from uuid import UUID

import pytest

from adapters.memory.fixed_clock_adapter import FixedClockAdapter, SequentialIdAdapter
from adapters.memory.memory_alert_repository import MemoryAlertRepository
from adapters.memory.memory_allowlist_repository import MemoryAllowlistRepository
from adapters.memory.memory_indicator_repository import MemoryIndicatorRepository
from adapters.memory.memory_search_adapter import MemorySearchAdapter
from adapters.memory.memory_threat_intel_adapter import MemoryThreatIntelAdapter
from application.ingest_dto import IngestEventCommand
from application.ingest_event_usecase import IngestEventUseCase
from domain.errors_entity import IntegrationUnavailableError, PolicyViolationError
from domain.event_entity import AssetCriticality, SourceProfile
from domain.indicator_entity import (
    AllowlistEntry,
    Confidence,
    IndicatorIntel,
    MatchKind,
    TlpLevel,
)
from domain.indicator_policy import from_intel
from domain.observable_entity import Observable, ObservableType
from domain.rules_entity import DEFAULT_DISPOSITION_RULES, DEFAULT_SCORING_RULES
from domain.search_entity import EventQuery
from domain.verdict_entity import Disposition, Severity


class UnreachableThreatIntel:
    """A threat intel source that is down, to prove triage survives it."""

    async def lookup(self, observable: Observable) -> IndicatorIntel | None:
        raise IntegrationUnavailableError("threat_intel", "connection refused")

    async def bulk_lookup(
        self, observables: Sequence[Observable]
    ) -> Mapping[Observable, IndicatorIntel]:
        raise IntegrationUnavailableError("threat_intel", "connection refused")

    async def pull_since(self, since: datetime, *, limit: int = 500) -> tuple[IndicatorIntel, ...]:
        raise IntegrationUnavailableError("threat_intel", "connection refused")

    async def publish_sighting(self, observable: Observable, observed_at: datetime) -> None:
        raise IntegrationUnavailableError("threat_intel", "connection refused")


NOW = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
BAD_IP = Observable(ObservableType.IPV4, "203.0.113.9")

PROFILE = SourceProfile(
    source="edr",
    field_map={
        "occurred_at": "event.time",
        "category": "event.category",
        "action": "event.action",
        "message": "event.message",
        "host": "agent.hostname",
    },
    observable_fields=("network.remote_ip",),
    criticality_by_host={"dc01": AssetCriticality.CROWN_JEWEL},
)


def payload(category: str = "malware", host: str = "web01") -> dict:
    """A realistic EDR payload."""
    return {
        "event": {
            "time": "2026-08-12T11:30:00+00:00",
            "category": category,
            "action": "process_exec",
            "message": "outbound connection",
        },
        "agent": {"hostname": host},
        "network": {"remote_ip": BAD_IP.value},
    }


def known_intel(confidence: int = 90, labels: tuple[str, ...] = ("c2",)) -> IndicatorIntel:
    """Intel marking the bad IP as malicious."""
    return IndicatorIntel(
        observable=BAD_IP,
        known=True,
        confidence=Confidence(confidence),
        threat_labels=labels,
        tlp=TlpLevel.AMBER,
        first_seen=NOW,
        last_seen=NOW,
        source="memory",
    )


@pytest.fixture
def clock() -> FixedClockAdapter:
    return FixedClockAdapter(NOW)


@pytest.fixture
def alerts() -> MemoryAlertRepository:
    return MemoryAlertRepository()


@pytest.fixture
def indicators() -> MemoryIndicatorRepository:
    return MemoryIndicatorRepository()


@pytest.fixture
def allowlist() -> MemoryAllowlistRepository:
    return MemoryAllowlistRepository()


@pytest.fixture
def search() -> MemorySearchAdapter:
    return MemorySearchAdapter()


def build(
    clock: FixedClockAdapter,
    alerts: MemoryAlertRepository,
    indicators: MemoryIndicatorRepository,
    allowlist: MemoryAllowlistRepository,
    search: MemorySearchAdapter,
    intel: MemoryThreatIntelAdapter | None = None,
) -> IngestEventUseCase:
    """Wire the use case against in-memory ports."""
    return IngestEventUseCase(
        threat_intel=intel or MemoryThreatIntelAdapter(),
        search=search,
        indicators=indicators,
        allowlist=allowlist,
        alerts=alerts,
        clock=clock,
        ids=SequentialIdAdapter(),
        profiles={"edr": PROFILE},
        scoring_rules=DEFAULT_SCORING_RULES,
        disposition_rules=DEFAULT_DISPOSITION_RULES,
    )


class TestIngestEvent:
    """The triage spine: normalize, enrich, score, decide, record."""

    async def test_event_matching_threat_intel_raises_an_alert(
        self,
        clock: FixedClockAdapter,
        alerts: MemoryAlertRepository,
        indicators: MemoryIndicatorRepository,
        allowlist: MemoryAllowlistRepository,
        search: MemorySearchAdapter,
    ) -> None:
        intel = MemoryThreatIntelAdapter((known_intel(),))
        usecase = build(clock, alerts, indicators, allowlist, search, intel)

        outcome = await usecase.execute(IngestEventCommand(source="edr", payload=payload()))

        assert outcome.verdict.severity is Severity.CRITICAL
        assert outcome.verdict.disposition is Disposition.ESCALATE
        assert outcome.alert is not None
        assert outcome.alert.observables == (BAD_IP,)

    async def test_alert_is_retrievable_afterwards(
        self,
        clock: FixedClockAdapter,
        alerts: MemoryAlertRepository,
        indicators: MemoryIndicatorRepository,
        allowlist: MemoryAllowlistRepository,
        search: MemorySearchAdapter,
    ) -> None:
        """Raising an alert means it can be found again, not just returned once."""
        intel = MemoryThreatIntelAdapter((known_intel(),))
        usecase = build(clock, alerts, indicators, allowlist, search, intel)

        outcome = await usecase.execute(IngestEventCommand(source="edr", payload=payload()))

        assert outcome.alert is not None
        assert await alerts.get(outcome.alert.alert_id) == outcome.alert

    async def test_event_with_no_intel_match_is_dropped(
        self,
        clock: FixedClockAdapter,
        alerts: MemoryAlertRepository,
        indicators: MemoryIndicatorRepository,
        allowlist: MemoryAllowlistRepository,
        search: MemorySearchAdapter,
    ) -> None:
        """Low-signal noise must not become work for a human."""
        usecase = build(clock, alerts, indicators, allowlist, search)

        outcome = await usecase.execute(
            IngestEventCommand(source="edr", payload=payload("policy_violation"))
        )

        assert outcome.verdict.disposition is Disposition.DROP
        assert outcome.alert is None
        assert await alerts.list_recent(limit=10) == ()

    async def test_allowlisted_observable_suppresses_the_finding(
        self,
        clock: FixedClockAdapter,
        alerts: MemoryAlertRepository,
        indicators: MemoryIndicatorRepository,
        allowlist: MemoryAllowlistRepository,
        search: MemorySearchAdapter,
    ) -> None:
        """A known-good artefact must beat even high-confidence intel."""
        await allowlist.add(
            AllowlistEntry(
                entry_id=UUID(int=99),
                observable=BAD_IP,
                match_kind=MatchKind.EXACT,
                reason="our own scanner",
                created_by="alice",
                created_at=NOW,
            )
        )
        intel = MemoryThreatIntelAdapter((known_intel(),))
        usecase = build(clock, alerts, indicators, allowlist, search, intel)

        outcome = await usecase.execute(IngestEventCommand(source="edr", payload=payload()))

        assert outcome.verdict.disposition is Disposition.DROP
        assert outcome.alert is None

    async def test_replayed_event_reuses_the_existing_alert(
        self,
        clock: FixedClockAdapter,
        alerts: MemoryAlertRepository,
        indicators: MemoryIndicatorRepository,
        allowlist: MemoryAllowlistRepository,
        search: MemorySearchAdapter,
    ) -> None:
        """Re-delivery from a log shipper must not double an analyst's queue."""
        intel = MemoryThreatIntelAdapter((known_intel(),))
        usecase = build(clock, alerts, indicators, allowlist, search, intel)
        command = IngestEventCommand(source="edr", payload=payload(), external_id="ext-1")

        first = await usecase.execute(command)
        second = await usecase.execute(command)

        assert second.deduplicated
        assert first.alert is not None
        assert second.alert is not None
        assert second.alert.alert_id == first.alert.alert_id
        assert len(await alerts.list_recent(limit=10)) == 1

    async def test_unknown_source_is_rejected(
        self,
        clock: FixedClockAdapter,
        alerts: MemoryAlertRepository,
        indicators: MemoryIndicatorRepository,
        allowlist: MemoryAllowlistRepository,
        search: MemorySearchAdapter,
    ) -> None:
        """Ingesting an unmapped source silently would produce meaningless events."""
        usecase = build(clock, alerts, indicators, allowlist, search)

        with pytest.raises(PolicyViolationError):
            await usecase.execute(IngestEventCommand(source="unmapped", payload=payload()))

    async def test_crown_jewel_asset_escalates_a_lesser_finding(
        self,
        clock: FixedClockAdapter,
        alerts: MemoryAlertRepository,
        indicators: MemoryIndicatorRepository,
        allowlist: MemoryAllowlistRepository,
        search: MemorySearchAdapter,
    ) -> None:
        intel = MemoryThreatIntelAdapter((known_intel(confidence=30, labels=()),))
        usecase = build(clock, alerts, indicators, allowlist, search, intel)

        standard = await usecase.execute(
            IngestEventCommand(source="edr", payload=payload("auth_failure", "web01"))
        )
        crown = await usecase.execute(
            IngestEventCommand(source="edr", payload=payload("auth_failure", "dc01"))
        )

        assert standard.verdict.disposition is not Disposition.ESCALATE
        assert crown.verdict.disposition is Disposition.ESCALATE

    async def test_the_event_is_indexed_for_search(
        self,
        clock: FixedClockAdapter,
        alerts: MemoryAlertRepository,
        indicators: MemoryIndicatorRepository,
        allowlist: MemoryAllowlistRepository,
        search: MemorySearchAdapter,
    ) -> None:
        usecase = build(clock, alerts, indicators, allowlist, search)

        outcome = await usecase.execute(IngestEventCommand(source="edr", payload=payload()))

        page = await search.search_events(EventQuery())
        assert {i.event_id for i in page.items} == {outcome.event.event_id}

    async def test_dropped_events_are_still_indexed(
        self,
        clock: FixedClockAdapter,
        alerts: MemoryAlertRepository,
        indicators: MemoryIndicatorRepository,
        allowlist: MemoryAllowlistRepository,
        search: MemorySearchAdapter,
    ) -> None:
        """Dropping is a triage decision, not a reason to lose the telemetry."""
        usecase = build(clock, alerts, indicators, allowlist, search)

        outcome = await usecase.execute(
            IngestEventCommand(source="edr", payload=payload("policy_violation"))
        )

        assert outcome.alert is None
        page = await search.search_events(EventQuery())
        assert page.total == 1

    async def test_intel_from_the_source_is_kept_as_our_own_indicator(
        self,
        clock: FixedClockAdapter,
        alerts: MemoryAlertRepository,
        indicators: MemoryIndicatorRepository,
        allowlist: MemoryAllowlistRepository,
        search: MemorySearchAdapter,
    ) -> None:
        """The whole point of owning state: the intel survives losing the source."""
        intel = MemoryThreatIntelAdapter((known_intel(),))
        usecase = build(clock, alerts, indicators, allowlist, search, intel)

        await usecase.execute(IngestEventCommand(source="edr", payload=payload()))

        held = await indicators.get_by_observable(BAD_IP)
        assert held is not None
        assert "c2" in held.threat_labels

    async def test_a_local_sighting_is_recorded(
        self,
        clock: FixedClockAdapter,
        alerts: MemoryAlertRepository,
        indicators: MemoryIndicatorRepository,
        allowlist: MemoryAllowlistRepository,
        search: MemorySearchAdapter,
    ) -> None:
        intel = MemoryThreatIntelAdapter((known_intel(),))
        usecase = build(clock, alerts, indicators, allowlist, search, intel)

        await usecase.execute(IngestEventCommand(source="edr", payload=payload()))

        held = await indicators.get_by_observable(BAD_IP)
        assert held is not None
        assert await indicators.count_sightings(held.indicator_id) == 1

    async def test_intel_outage_degrades_instead_of_failing(
        self,
        clock: FixedClockAdapter,
        alerts: MemoryAlertRepository,
        indicators: MemoryIndicatorRepository,
        allowlist: MemoryAllowlistRepository,
        search: MemorySearchAdapter,
    ) -> None:
        """An unreachable intel platform must not stop the pipeline.

        The event still scores on its own merits — it simply scores without
        any intel contribution, and the verdict says so.
        """
        usecase = build(clock, alerts, indicators, allowlist, search, UnreachableThreatIntel())

        outcome = await usecase.execute(IngestEventCommand(source="edr", payload=payload()))

        assert outcome.enrichment_degraded
        assert outcome.verdict.matched == ()
        assert any("degraded" in reason for reason in outcome.verdict.reasons)

    async def test_locally_known_indicator_still_scores_during_an_outage(
        self,
        clock: FixedClockAdapter,
        alerts: MemoryAlertRepository,
        indicators: MemoryIndicatorRepository,
        allowlist: MemoryAllowlistRepository,
        search: MemorySearchAdapter,
    ) -> None:
        """Local-first enrichment is what makes the outage survivable."""
        await indicators.upsert(from_intel(known_intel(), UUID(int=5), NOW))
        usecase = build(clock, alerts, indicators, allowlist, search, UnreachableThreatIntel())

        outcome = await usecase.execute(IngestEventCommand(source="edr", payload=payload()))

        assert outcome.verdict.disposition is Disposition.ESCALATE
        assert outcome.alert is not None
