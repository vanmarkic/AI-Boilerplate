"""Turn an alert into an investigation.

Ordering matters: the local case is saved *before* the external case manager is
called, and the external reference is attached afterwards. An outage in the
case manager therefore costs us a mirror, never the investigation itself.
"""

from uuid import UUID

from application.alert_repository_port import AlertRepositoryPort
from application.case_management_port import CaseManagementPort
from application.case_repository_port import CaseRepositoryPort
from application.clock_port import ClockPort, IdGeneratorPort
from domain.case_entity import Case, CaseDraft, CaseNote, CaseStatus
from domain.case_policy import attach_external_ref, merge_alert
from domain.errors_entity import IntegrationError, UnknownEntityError
from domain.verdict_entity import Alert


class EscalateAlertUseCase:
    """Correlates an alert onto a case, opening one if none is open."""

    def __init__(
        self,
        *,
        alerts: AlertRepositoryPort,
        cases: CaseRepositoryPort,
        case_manager: CaseManagementPort,
        clock: ClockPort,
        ids: IdGeneratorPort,
    ) -> None:
        self._alerts = alerts
        self._cases = cases
        self._case_manager = case_manager
        self._clock = clock
        self._ids = ids

    def _draft_for(self, alert: Alert) -> CaseDraft:
        """Describe an alert to whichever case system is configured."""
        return CaseDraft(
            title=alert.title,
            summary="\n".join(alert.reasons) or alert.title,
            severity=alert.severity,
            correlation_key=alert.correlation_key,
            observables=alert.observables,
            tags=alert.labels,
        )

    async def _mirror_new_case(self, case: Case, alert: Alert) -> Case:
        """Open the case externally and attach the reference, if we can.

        Failure is swallowed on purpose: the case already exists locally, and
        losing the mirror is strictly better than losing the investigation.
        """
        try:
            ref = await self._case_manager.open_case(self._draft_for(alert))
            await self._case_manager.attach_observables(ref, alert.observables)
        except IntegrationError:
            return case
        mirrored = attach_external_ref(case, ref, self._clock.now())
        return await self._cases.save(mirrored)

    async def _mirror_joined_alert(self, case: Case, alert: Alert, actor: str) -> None:
        """Note the additional alert on the external case, if we can."""
        if case.external_ref is None:
            return
        try:
            await self._case_manager.add_note(
                case.external_ref,
                CaseNote(
                    title=f"Alert joined: {alert.title}",
                    body="\n".join(alert.reasons) or alert.title,
                    author=actor,
                ),
            )
            await self._case_manager.attach_observables(case.external_ref, alert.observables)
        except IntegrationError:
            return

    async def _link_alert(self, alert: Alert, case: Case) -> None:
        """Point the alert at its case so an analyst can navigate between them."""
        if alert.case_id == case.case_id:
            return
        await self._alerts.save(
            Alert(
                alert_id=alert.alert_id,
                event_id=alert.event_id,
                dedup_key=alert.dedup_key,
                correlation_key=alert.correlation_key,
                title=alert.title,
                severity=alert.severity,
                disposition=alert.disposition,
                score=alert.score,
                reasons=alert.reasons,
                observables=alert.observables,
                source=alert.source,
                host=alert.host,
                asset_criticality=alert.asset_criticality,
                occurred_at=alert.occurred_at,
                created_at=alert.created_at,
                case_id=case.case_id,
                labels=alert.labels,
            )
        )

    async def execute(self, alert_id: UUID, *, actor: str) -> Case:
        """Escalate one alert and return the case it now belongs to."""
        alert = await self._alerts.get(alert_id)
        if alert is None:
            raise UnknownEntityError(f"unknown alert {alert_id}")

        now = self._clock.now()
        existing = await self._cases.find_open_by_correlation_key(alert.correlation_key)

        if existing is None:
            case = await self._cases.save(
                Case(
                    case_id=self._ids.new_id(),
                    correlation_key=alert.correlation_key,
                    title=alert.title,
                    status=CaseStatus.OPEN,
                    severity=alert.severity,
                    alert_ids=(alert.alert_id,),
                    opened_at=now,
                    updated_at=now,
                )
            )
            case = await self._mirror_new_case(case, alert)
            await self._link_alert(alert, case)
            return case

        if alert.alert_id in existing.alert_ids:
            return existing

        joined = await self._cases.save(merge_alert(existing, alert, now))
        await self._mirror_joined_alert(joined, alert, actor)
        await self._link_alert(alert, joined)
        return joined
