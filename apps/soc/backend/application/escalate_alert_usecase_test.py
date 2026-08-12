"""Escalating alerts into cases, driven through in-memory ports."""

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from adapters.memory.fixed_clock_adapter import FixedClockAdapter, SequentialIdAdapter
from adapters.memory.memory_alert_repository import MemoryAlertRepository
from adapters.memory.memory_case_adapter import MemoryCaseAdapter
from adapters.memory.memory_case_repository import MemoryCaseRepository
from application.escalate_alert_usecase import EscalateAlertUseCase
from domain.case_entity import CaseStatus
from domain.event_entity import AssetCriticality
from domain.observable_entity import Observable, ObservableType
from domain.soc_error import UnknownEntityError
from domain.verdict_entity import Alert, Disposition, Severity

NOW = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
IP = Observable(ObservableType.IPV4, "203.0.113.9")


def make_alert(
    correlation_key: str = "corr-1",
    severity: Severity = Severity.HIGH,
    alert_id: UUID | None = None,
) -> Alert:
    """Build an escalatable alert."""
    return Alert(
        alert_id=alert_id or uuid4(),
        event_id=uuid4(),
        dedup_key=f"dedup-{correlation_key}",
        title="Beaconing to known C2",
        severity=severity,
        disposition=Disposition.ESCALATE,
        score=85,
        reasons=("intel hit",),
        observables=(IP,),
        source="edr",
        host="web01",
        asset_criticality=AssetCriticality.STANDARD,
        occurred_at=NOW,
        created_at=NOW,
        correlation_key=correlation_key,
    )


@pytest.fixture
def alerts() -> MemoryAlertRepository:
    return MemoryAlertRepository()


@pytest.fixture
def cases() -> MemoryCaseRepository:
    return MemoryCaseRepository()


@pytest.fixture
def case_manager() -> MemoryCaseAdapter:
    return MemoryCaseAdapter()


@pytest.fixture
def usecase(
    alerts: MemoryAlertRepository,
    cases: MemoryCaseRepository,
    case_manager: MemoryCaseAdapter,
) -> EscalateAlertUseCase:
    return EscalateAlertUseCase(
        alerts=alerts,
        cases=cases,
        case_manager=case_manager,
        clock=FixedClockAdapter(NOW),
        ids=SequentialIdAdapter(),
    )


class TestEscalateAlert:
    """Correlate, then either open a case or absorb into an existing one."""

    async def test_first_escalation_opens_a_case(
        self, alerts: MemoryAlertRepository, usecase: EscalateAlertUseCase
    ) -> None:
        alert = await alerts.save(make_alert())

        case = await usecase.execute(alert.alert_id, actor="alice")

        assert case.status is CaseStatus.OPEN
        assert case.alert_ids == (alert.alert_id,)
        assert case.severity is Severity.HIGH

    async def test_the_case_is_mirrored_to_the_external_system(
        self,
        alerts: MemoryAlertRepository,
        case_manager: MemoryCaseAdapter,
        usecase: EscalateAlertUseCase,
    ) -> None:
        alert = await alerts.save(make_alert())

        case = await usecase.execute(alert.alert_id, actor="alice")

        assert case.external_ref is not None
        snapshot = await case_manager.fetch_case(case.external_ref)
        assert snapshot is not None
        assert snapshot.status is CaseStatus.OPEN

    async def test_observables_are_attached_to_the_external_case(
        self,
        alerts: MemoryAlertRepository,
        case_manager: MemoryCaseAdapter,
        usecase: EscalateAlertUseCase,
    ) -> None:
        alert = await alerts.save(make_alert())

        case = await usecase.execute(alert.alert_id, actor="alice")

        assert case.external_ref is not None
        assert case_manager.observables_for(case.external_ref) == (IP,)

    async def test_the_alert_is_linked_back_to_its_case(
        self, alerts: MemoryAlertRepository, usecase: EscalateAlertUseCase
    ) -> None:
        """An analyst looking at the alert must be able to reach the case."""
        alert = await alerts.save(make_alert())

        case = await usecase.execute(alert.alert_id, actor="alice")

        linked = await alerts.get(alert.alert_id)
        assert linked is not None
        assert linked.case_id == case.case_id

    async def test_second_alert_with_the_same_key_joins_the_existing_case(
        self,
        alerts: MemoryAlertRepository,
        cases: MemoryCaseRepository,
        usecase: EscalateAlertUseCase,
    ) -> None:
        """One campaign is one investigation, not a case per event."""
        first = await alerts.save(make_alert("shared-key"))
        second = await alerts.save(make_alert("shared-key"))

        opened = await usecase.execute(first.alert_id, actor="alice")
        joined = await usecase.execute(second.alert_id, actor="alice")

        assert joined.case_id == opened.case_id
        assert set(joined.alert_ids) == {first.alert_id, second.alert_id}
        assert len(await cases.list_open(limit=10)) == 1

    async def test_joining_a_case_records_a_note(
        self,
        alerts: MemoryAlertRepository,
        case_manager: MemoryCaseAdapter,
        usecase: EscalateAlertUseCase,
    ) -> None:
        first = await alerts.save(make_alert("shared-key"))
        second = await alerts.save(make_alert("shared-key"))

        case = await usecase.execute(first.alert_id, actor="alice")
        await usecase.execute(second.alert_id, actor="alice")

        assert case.external_ref is not None
        assert case_manager.notes_for(case.external_ref)

    async def test_a_worse_alert_raises_the_case_severity(
        self, alerts: MemoryAlertRepository, usecase: EscalateAlertUseCase
    ) -> None:
        first = await alerts.save(make_alert("shared-key", Severity.MEDIUM))
        second = await alerts.save(make_alert("shared-key", Severity.CRITICAL))

        await usecase.execute(first.alert_id, actor="alice")
        joined = await usecase.execute(second.alert_id, actor="alice")

        assert joined.severity is Severity.CRITICAL

    async def test_a_recurrence_after_closure_opens_a_new_case(
        self,
        alerts: MemoryAlertRepository,
        cases: MemoryCaseRepository,
        case_manager: MemoryCaseAdapter,
        usecase: EscalateAlertUseCase,
    ) -> None:
        """Closing means done; the same key later is a fresh investigation."""
        first = await alerts.save(make_alert("shared-key"))
        opened = await usecase.execute(first.alert_id, actor="alice")

        closed = await cases.get(opened.case_id)
        assert closed is not None
        await cases.save(
            type(closed)(
                case_id=closed.case_id,
                correlation_key=closed.correlation_key,
                title=closed.title,
                status=CaseStatus.CLOSED_RESOLVED,
                severity=closed.severity,
                alert_ids=closed.alert_ids,
                opened_at=closed.opened_at,
                updated_at=NOW,
                closed_at=NOW,
                external_ref=closed.external_ref,
            )
        )

        second = await alerts.save(make_alert("shared-key"))
        reopened = await usecase.execute(second.alert_id, actor="alice")

        assert reopened.case_id != opened.case_id

    async def test_escalating_the_same_alert_twice_is_idempotent(
        self,
        alerts: MemoryAlertRepository,
        cases: MemoryCaseRepository,
        usecase: EscalateAlertUseCase,
    ) -> None:
        alert = await alerts.save(make_alert())

        first = await usecase.execute(alert.alert_id, actor="alice")
        second = await usecase.execute(alert.alert_id, actor="alice")

        assert second.case_id == first.case_id
        assert second.alert_ids == (alert.alert_id,)
        assert len(await cases.list_open(limit=10)) == 1

    async def test_escalating_an_unknown_alert_is_rejected(
        self, usecase: EscalateAlertUseCase
    ) -> None:
        with pytest.raises(UnknownEntityError):
            await usecase.execute(uuid4(), actor="alice")
