"""Automated response, driven through in-memory ports."""

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from adapters.memory.fixed_clock_adapter import FixedClockAdapter, SequentialIdAdapter
from adapters.memory.memory_alert_repository import MemoryAlertRepository
from adapters.memory.memory_orchestration_adapter import MemoryOrchestrationAdapter
from adapters.memory.memory_playbook_run_repository import MemoryPlaybookRunRepository
from application.respond_to_alert_usecase import RespondToAlertUseCase
from domain.event_entity import AssetCriticality
from domain.observable_entity import Observable, ObservableType
from domain.playbook_entity import (
    PlaybookCatalog,
    PlaybookRule,
    PlaybookRunStatus,
    PlaybookSummary,
)
from domain.soc_error import UnknownEntityError
from domain.verdict_entity import Alert, Disposition, Severity

NOW = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
IP = Observable(ObservableType.IPV4, "203.0.113.9")

CATALOGUE = (PlaybookSummary(playbook_id="isolate-host", name="Isolate host"),)
CATALOG = PlaybookCatalog(
    rules=(
        PlaybookRule(
            playbook_id="isolate-host",
            min_severity=Severity.HIGH,
            dispositions=(Disposition.ESCALATE,),
            priority=100,
        ),
    )
)


def make_alert(
    severity: Severity = Severity.HIGH,
    disposition: Disposition = Disposition.ESCALATE,
    alert_id: UUID | None = None,
) -> Alert:
    """Build an alert worth responding to."""
    return Alert(
        alert_id=alert_id or uuid4(),
        event_id=uuid4(),
        dedup_key="dedup-1",
        correlation_key="corr-1",
        title="Beaconing",
        severity=severity,
        disposition=disposition,
        score=85,
        reasons=(),
        observables=(IP,),
        source="edr",
        host="web01",
        asset_criticality=AssetCriticality.STANDARD,
        occurred_at=NOW,
        created_at=NOW,
    )


@pytest.fixture
def alerts() -> MemoryAlertRepository:
    return MemoryAlertRepository()


@pytest.fixture
def runs() -> MemoryPlaybookRunRepository:
    return MemoryPlaybookRunRepository()


@pytest.fixture
def orchestrator() -> MemoryOrchestrationAdapter:
    return MemoryOrchestrationAdapter(CATALOGUE, FixedClockAdapter(NOW))


@pytest.fixture
def usecase(
    alerts: MemoryAlertRepository,
    runs: MemoryPlaybookRunRepository,
    orchestrator: MemoryOrchestrationAdapter,
) -> RespondToAlertUseCase:
    return RespondToAlertUseCase(
        alerts=alerts,
        runs=runs,
        orchestrator=orchestrator,
        catalog=CATALOG,
        clock=FixedClockAdapter(NOW),
        ids=SequentialIdAdapter(),
    )


class TestRespondToAlert:
    """Select a playbook, launch it once, and record what happened."""

    async def test_matching_alert_launches_its_playbook(
        self, alerts: MemoryAlertRepository, usecase: RespondToAlertUseCase
    ) -> None:
        alert = await alerts.save(make_alert())

        run = await usecase.execute(alert.alert_id)

        assert run.playbook_id == "isolate-host"
        assert run.status is PlaybookRunStatus.SUCCEEDED
        assert run.handle is not None

    async def test_the_run_is_retrievable_afterwards(
        self,
        alerts: MemoryAlertRepository,
        runs: MemoryPlaybookRunRepository,
        usecase: RespondToAlertUseCase,
    ) -> None:
        alert = await alerts.save(make_alert())

        run = await usecase.execute(alert.alert_id)

        assert await runs.get(run.run_id) == run

    async def test_the_orchestrator_receives_the_alert_context(
        self,
        alerts: MemoryAlertRepository,
        orchestrator: MemoryOrchestrationAdapter,
        usecase: RespondToAlertUseCase,
    ) -> None:
        alert = await alerts.save(make_alert())

        run = await usecase.execute(alert.alert_id)

        assert run.handle is not None
        assert orchestrator.inputs_for(run.handle)["host"] == "web01"

    async def test_responding_twice_does_not_launch_twice(
        self,
        alerts: MemoryAlertRepository,
        orchestrator: MemoryOrchestrationAdapter,
        usecase: RespondToAlertUseCase,
    ) -> None:
        """The guarantee the orchestrator does not give us: containment fires once."""
        alert = await alerts.save(make_alert())

        first = await usecase.execute(alert.alert_id)
        second = await usecase.execute(alert.alert_id)

        assert second.run_id == first.run_id
        assert second.handle == first.handle

    async def test_an_alert_matching_no_rule_is_skipped(
        self, alerts: MemoryAlertRepository, usecase: RespondToAlertUseCase
    ) -> None:
        alert = await alerts.save(make_alert(Severity.LOW, Disposition.MONITOR))

        run = await usecase.execute(alert.alert_id)

        assert run.status is PlaybookRunStatus.SKIPPED
        assert run.playbook_id == ""
        assert "no playbook rule matched" in (run.error or "")

    async def test_a_skipped_alert_is_not_sent_to_the_orchestrator(
        self,
        alerts: MemoryAlertRepository,
        orchestrator: MemoryOrchestrationAdapter,
        usecase: RespondToAlertUseCase,
    ) -> None:
        alert = await alerts.save(make_alert(Severity.LOW, Disposition.MONITOR))

        run = await usecase.execute(alert.alert_id)

        assert run.handle is None

    async def test_responding_to_an_unknown_alert_is_rejected(
        self, usecase: RespondToAlertUseCase
    ) -> None:
        with pytest.raises(UnknownEntityError):
            await usecase.execute(uuid4())

    async def test_the_run_is_linked_to_the_alert(
        self, alerts: MemoryAlertRepository, usecase: RespondToAlertUseCase
    ) -> None:
        alert = await alerts.save(make_alert())

        run = await usecase.execute(alert.alert_id)

        assert run.alert_id == alert.alert_id
