"""Decide and launch an automated response.

The idempotency guarantee lives here, not in the orchestrator: the run is
recorded under a domain-derived key *before* the orchestrator is called, so a
retry finds the existing record instead of firing containment a second time.
"""

from uuid import UUID

from application.alert_repository_port import AlertRepositoryPort
from application.clock_port import ClockPort, IdGeneratorPort
from application.orchestration_port import PlaybookOrchestrationPort
from application.playbook_run_repository_port import PlaybookRunRepositoryPort
from domain.playbook_entity import (
    PlaybookCatalog,
    PlaybookDecision,
    PlaybookRun,
    PlaybookRunStatus,
)
from domain.playbook_policy import select
from domain.soc_error import IntegrationError, UnknownEntityError
from domain.verdict_entity import Alert


class RespondToAlertUseCase:
    """Chooses a playbook for an alert and launches it at most once."""

    def __init__(
        self,
        *,
        alerts: AlertRepositoryPort,
        runs: PlaybookRunRepositoryPort,
        orchestrator: PlaybookOrchestrationPort,
        catalog: PlaybookCatalog,
        clock: ClockPort,
        ids: IdGeneratorPort,
    ) -> None:
        self._alerts = alerts
        self._runs = runs
        self._orchestrator = orchestrator
        self._catalog = catalog
        self._clock = clock
        self._ids = ids

    async def _skip(self, alert: Alert, decision: PlaybookDecision) -> PlaybookRun:
        """Record that no response was warranted, and why — once.

        A decline goes through the same idempotency lookup as a launch. Deciding
        not to act is still a decision, and asking twice should return the first
        answer rather than filing a second identical refusal.
        """
        already = await self._runs.find_by_idempotency_key(decision.idempotency_key)
        if already is not None:
            return already

        now = self._clock.now()
        return await self._runs.save(
            PlaybookRun(
                run_id=self._ids.new_id(),
                idempotency_key=decision.idempotency_key,
                playbook_id=None,
                status=PlaybookRunStatus.SKIPPED,
                inputs={},
                started_at=now,
                alert_id=alert.alert_id,
                case_id=alert.case_id,
                error=decision.reason,
                finished_at=now,
            )
        )

    async def execute(self, alert_id: UUID) -> PlaybookRun:
        """Respond to one alert and return the run that represents it."""
        alert = await self._alerts.get(alert_id)
        if alert is None:
            raise UnknownEntityError(f"unknown alert {alert_id}")

        decision = select(alert, self._catalog)
        if not decision.should_run or decision.playbook_id is None:
            return await self._skip(alert, decision)

        already = await self._runs.find_by_idempotency_key(decision.idempotency_key)
        if already is not None:
            return already

        now = self._clock.now()
        pending = await self._runs.save(
            PlaybookRun(
                run_id=self._ids.new_id(),
                idempotency_key=decision.idempotency_key,
                playbook_id=decision.playbook_id,
                status=PlaybookRunStatus.PENDING,
                inputs=decision.inputs,
                started_at=now,
                alert_id=alert.alert_id,
                case_id=alert.case_id,
            )
        )

        try:
            handle = await self._orchestrator.launch(decision)
        except IntegrationError as exc:
            return await self._runs.save(
                PlaybookRun(
                    run_id=pending.run_id,
                    idempotency_key=pending.idempotency_key,
                    playbook_id=pending.playbook_id,
                    status=PlaybookRunStatus.FAILED,
                    inputs=pending.inputs,
                    started_at=pending.started_at,
                    alert_id=pending.alert_id,
                    case_id=pending.case_id,
                    error=str(exc),
                    finished_at=self._clock.now(),
                )
            )

        outcome = await self._orchestrator.get_outcome(handle)
        status = outcome.status if outcome else PlaybookRunStatus.RUNNING
        return await self._runs.save(
            PlaybookRun(
                run_id=pending.run_id,
                idempotency_key=pending.idempotency_key,
                playbook_id=pending.playbook_id,
                status=status,
                inputs=pending.inputs,
                started_at=pending.started_at,
                alert_id=pending.alert_id,
                case_id=pending.case_id,
                handle=handle,
                output=outcome.output if outcome else {},
                error=outcome.error if outcome else None,
                finished_at=outcome.finished_at if outcome else None,
            )
        )
