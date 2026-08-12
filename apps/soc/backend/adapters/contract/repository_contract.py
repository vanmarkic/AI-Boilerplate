"""Behaviour every repository implementation must exhibit.

These hold the core's *own* state — the state that must survive swapping any
third party. Each contract is run against the in-memory implementation and,
where one exists, the relational one.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest

from application.alert_repository_port import AlertRepositoryPort
from application.allowlist_repository_port import AllowlistRepositoryPort
from application.case_repository_port import CaseRepositoryPort
from application.indicator_repository_port import IndicatorRepositoryPort
from application.playbook_run_repository_port import PlaybookRunRepositoryPort
from domain.case_entity import Case, CaseStatus
from domain.event_entity import AssetCriticality
from domain.indicator_entity import (
    AllowlistEntry,
    Confidence,
    Indicator,
    IndicatorStatus,
    MatchKind,
    Sighting,
    TlpLevel,
)
from domain.observable_entity import Observable, ObservableType
from domain.playbook_entity import PlaybookRun, PlaybookRunStatus
from domain.verdict_entity import Alert, Disposition, Severity

NOW = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
IP = Observable(ObservableType.IPV4, "203.0.113.9")
OTHER = Observable(ObservableType.DOMAIN, "evil.com")


def make_indicator(
    observable: Observable = IP,
    confidence: int = 80,
    last_seen: datetime = NOW,
    indicator_id: UUID | None = None,
) -> Indicator:
    """Build an indicator."""
    return Indicator(
        indicator_id=indicator_id or uuid4(),
        observable=observable,
        confidence=Confidence(confidence),
        status=IndicatorStatus.ACTIVE,
        threat_labels=("c2",),
        tlp=TlpLevel.AMBER,
        first_seen=NOW,
        last_seen=last_seen,
        sighting_count=0,
        source="test",
    )


def make_alert(dedup_key: str = "dedup-1", alert_id: UUID | None = None) -> Alert:
    """Build an alert."""
    return Alert(
        alert_id=alert_id or uuid4(),
        event_id=uuid4(),
        dedup_key=dedup_key,
        title="Suspicious",
        severity=Severity.HIGH,
        disposition=Disposition.ESCALATE,
        score=75,
        reasons=("test",),
        observables=(IP,),
        source="test",
        host="web01",
        asset_criticality=AssetCriticality.STANDARD,
        occurred_at=NOW,
        created_at=NOW,
    )


def make_case(correlation_key: str = "corr-1", status: CaseStatus = CaseStatus.OPEN) -> Case:
    """Build a case."""
    return Case(
        case_id=uuid4(),
        correlation_key=correlation_key,
        title="Investigation",
        status=status,
        severity=Severity.HIGH,
        alert_ids=(),
        opened_at=NOW,
        updated_at=NOW,
    )


def make_run(idempotency_key: str = "idem-1") -> PlaybookRun:
    """Build a playbook run."""
    return PlaybookRun(
        run_id=uuid4(),
        idempotency_key=idempotency_key,
        playbook_id="isolate-host",
        status=PlaybookRunStatus.PENDING,
        inputs={"host": "web01"},
        started_at=NOW,
    )


class IndicatorRepositoryContract:
    """Subclass this and supply ``repo``."""

    @pytest.fixture
    def repo(self) -> IndicatorRepositoryPort:
        raise NotImplementedError

    async def test_satisfies_the_port(self, repo: IndicatorRepositoryPort) -> None:
        assert isinstance(repo, IndicatorRepositoryPort)

    async def test_unknown_observable_returns_none(self, repo: IndicatorRepositoryPort) -> None:
        assert await repo.get_by_observable(IP) is None

    async def test_saved_indicator_is_retrievable(self, repo: IndicatorRepositoryPort) -> None:
        saved = await repo.upsert(make_indicator())
        found = await repo.get_by_observable(IP)
        assert found is not None
        assert found.indicator_id == saved.indicator_id

    async def test_upsert_updates_rather_than_duplicates(
        self, repo: IndicatorRepositoryPort
    ) -> None:
        """Two feeds reporting the same observable must not create two records."""
        first = await repo.upsert(make_indicator(confidence=50))
        await repo.upsert(make_indicator(confidence=90, indicator_id=first.indicator_id))
        found = await repo.get_by_observable(IP)
        assert found is not None
        assert found.confidence.value == 90
        assert len(await repo.get_many([IP])) == 1

    async def test_get_many_omits_unknown_observables(self, repo: IndicatorRepositoryPort) -> None:
        await repo.upsert(make_indicator())
        found = await repo.get_many([IP, OTHER])
        assert {i.observable for i in found} == {IP}

    async def test_stale_indicators_are_listable(self, repo: IndicatorRepositoryPort) -> None:
        await repo.upsert(make_indicator(IP, last_seen=NOW - timedelta(days=365)))
        await repo.upsert(make_indicator(OTHER, last_seen=NOW))
        stale = await repo.list_stale(NOW - timedelta(days=30), limit=10)
        assert {i.observable for i in stale} == {IP}

    async def test_sightings_are_recorded_and_counted(self, repo: IndicatorRepositoryPort) -> None:
        indicator = await repo.upsert(make_indicator())
        await repo.record_sighting(
            Sighting(
                sighting_id=uuid4(),
                indicator_id=indicator.indicator_id,
                event_id=uuid4(),
                observed_at=NOW,
                source="test",
            )
        )
        assert await repo.count_sightings(indicator.indicator_id) == 1


class AllowlistRepositoryContract:
    """Subclass this and supply ``repo``."""

    @pytest.fixture
    def repo(self) -> AllowlistRepositoryPort:
        raise NotImplementedError

    def entry(self, expires: datetime | None = None) -> AllowlistEntry:
        """Build an allowlist entry."""
        return AllowlistEntry(
            entry_id=uuid4(),
            observable=IP,
            match_kind=MatchKind.EXACT,
            reason="known good",
            created_by="alice",
            created_at=NOW,
            expires_at=expires,
        )

    async def test_satisfies_the_port(self, repo: AllowlistRepositoryPort) -> None:
        assert isinstance(repo, AllowlistRepositoryPort)

    async def test_added_entry_is_listed_as_active(self, repo: AllowlistRepositoryPort) -> None:
        added = await repo.add(self.entry())
        active = await repo.list_active(NOW)
        assert added.entry_id in {e.entry_id for e in active}

    async def test_expired_entries_are_not_listed(self, repo: AllowlistRepositoryPort) -> None:
        await repo.add(self.entry(expires=NOW - timedelta(days=1)))
        assert await repo.list_active(NOW) == ()

    async def test_removed_entry_is_gone(self, repo: AllowlistRepositoryPort) -> None:
        added = await repo.add(self.entry())
        assert await repo.remove(added.entry_id)
        assert await repo.list_active(NOW) == ()

    async def test_removing_an_unknown_entry_reports_failure(
        self, repo: AllowlistRepositoryPort
    ) -> None:
        assert not await repo.remove(uuid4())


class AlertRepositoryContract:
    """Subclass this and supply ``repo``."""

    @pytest.fixture
    def repo(self) -> AlertRepositoryPort:
        raise NotImplementedError

    async def test_satisfies_the_port(self, repo: AlertRepositoryPort) -> None:
        assert isinstance(repo, AlertRepositoryPort)

    async def test_saved_alert_is_retrievable(self, repo: AlertRepositoryPort) -> None:
        alert = await repo.save(make_alert())
        found = await repo.get(alert.alert_id)
        assert found is not None
        assert found.alert_id == alert.alert_id

    async def test_unknown_alert_returns_none(self, repo: AlertRepositoryPort) -> None:
        assert await repo.get(uuid4()) is None

    async def test_alerts_are_findable_by_dedup_key(self, repo: AlertRepositoryPort) -> None:
        """A replayed event must find its existing alert instead of making another."""
        alert = await repo.save(make_alert("dedup-x"))
        found = await repo.find_by_dedup_key("dedup-x")
        assert found is not None
        assert found.alert_id == alert.alert_id

    async def test_unknown_dedup_key_finds_nothing(self, repo: AlertRepositoryPort) -> None:
        assert await repo.find_by_dedup_key("never-seen") is None

    async def test_recent_alerts_are_listed_newest_first(self, repo: AlertRepositoryPort) -> None:
        await repo.save(make_alert("a"))
        await repo.save(make_alert("b"))
        listed = await repo.list_recent(limit=10, offset=0)
        assert len(listed) == 2


class CaseRepositoryContract:
    """Subclass this and supply ``repo``."""

    @pytest.fixture
    def repo(self) -> CaseRepositoryPort:
        raise NotImplementedError

    async def test_satisfies_the_port(self, repo: CaseRepositoryPort) -> None:
        assert isinstance(repo, CaseRepositoryPort)

    async def test_saved_case_is_retrievable(self, repo: CaseRepositoryPort) -> None:
        case = await repo.save(make_case())
        found = await repo.get(case.case_id)
        assert found is not None
        assert found.case_id == case.case_id

    async def test_unknown_case_returns_none(self, repo: CaseRepositoryPort) -> None:
        assert await repo.get(uuid4()) is None

    async def test_open_case_is_findable_by_correlation_key(self, repo: CaseRepositoryPort) -> None:
        case = await repo.save(make_case("corr-find"))
        found = await repo.find_open_by_correlation_key("corr-find")
        assert found is not None
        assert found.case_id == case.case_id

    async def test_closed_case_is_not_found_as_open(self, repo: CaseRepositoryPort) -> None:
        """A recurrence after closure is a new investigation, not a reopening."""
        await repo.save(make_case("corr-closed", CaseStatus.CLOSED_RESOLVED))
        assert await repo.find_open_by_correlation_key("corr-closed") is None

    async def test_saving_the_same_case_twice_updates_it(self, repo: CaseRepositoryPort) -> None:
        case = await repo.save(make_case())
        updated = Case(
            case_id=case.case_id,
            correlation_key=case.correlation_key,
            title=case.title,
            status=CaseStatus.CONTAINED,
            severity=case.severity,
            alert_ids=case.alert_ids,
            opened_at=case.opened_at,
            updated_at=NOW,
        )
        await repo.save(updated)
        found = await repo.get(case.case_id)
        assert found is not None
        assert found.status is CaseStatus.CONTAINED


class PlaybookRunRepositoryContract:
    """Subclass this and supply ``repo``."""

    @pytest.fixture
    def repo(self) -> PlaybookRunRepositoryPort:
        raise NotImplementedError

    async def test_satisfies_the_port(self, repo: PlaybookRunRepositoryPort) -> None:
        assert isinstance(repo, PlaybookRunRepositoryPort)

    async def test_saved_run_is_retrievable(self, repo: PlaybookRunRepositoryPort) -> None:
        run = await repo.save(make_run())
        found = await repo.get(run.run_id)
        assert found is not None
        assert found.run_id == run.run_id

    async def test_runs_are_findable_by_idempotency_key(
        self, repo: PlaybookRunRepositoryPort
    ) -> None:
        """This lookup is the whole idempotency guarantee the orchestrator lacks."""
        run = await repo.save(make_run("idem-x"))
        found = await repo.find_by_idempotency_key("idem-x")
        assert found is not None
        assert found.run_id == run.run_id

    async def test_unknown_idempotency_key_finds_nothing(
        self, repo: PlaybookRunRepositoryPort
    ) -> None:
        assert await repo.find_by_idempotency_key("never-used") is None

    async def test_saving_the_same_run_twice_updates_it(
        self, repo: PlaybookRunRepositoryPort
    ) -> None:
        run = await repo.save(make_run())
        await repo.save(
            PlaybookRun(
                run_id=run.run_id,
                idempotency_key=run.idempotency_key,
                playbook_id=run.playbook_id,
                status=PlaybookRunStatus.SUCCEEDED,
                inputs=run.inputs,
                started_at=run.started_at,
            )
        )
        found = await repo.get(run.run_id)
        assert found is not None
        assert found.status is PlaybookRunStatus.SUCCEEDED
