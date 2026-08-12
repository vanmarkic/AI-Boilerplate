"""The triage spine: normalize, enrich, score, decide, record.

Ordering is deliberate. Business state (the alert) is committed to our own
store before anything is handed to the search sink, so a search outage can
degrade dashboards but never lose a finding.
"""

from collections.abc import Mapping

from application.alert_repository_port import AlertRepositoryPort
from application.allowlist_repository_port import AllowlistRepositoryPort
from application.clock_port import ClockPort, IdGeneratorPort
from application.enrich_observables_usecase import EnrichObservablesUseCase
from application.indicator_repository_port import IndicatorRepositoryPort
from application.ingest_dto import IngestEventCommand, TriageOutcome
from application.search_port import DocumentSearchPort
from application.threat_intel_port import ThreatIntelPort
from domain.correlation_policy import DEFAULT_BUCKET_HOURS, correlation_key
from domain.disposition_policy import decide
from domain.errors_entity import IntegrationError, PolicyViolationError
from domain.event_entity import NormalizedEvent, RawEvent, SourceProfile
from domain.normalization_policy import normalize
from domain.rules_entity import DispositionRules, ScoringRules
from domain.severity_policy import labels_from, score_event
from domain.verdict_entity import Alert, Disposition, EnrichmentResult, TriageVerdict


class IngestEventUseCase:
    """Turns one raw event into a verdict, and an alert when it warrants one."""

    def __init__(
        self,
        *,
        threat_intel: ThreatIntelPort,
        search: DocumentSearchPort,
        indicators: IndicatorRepositoryPort,
        allowlist: AllowlistRepositoryPort,
        alerts: AlertRepositoryPort,
        clock: ClockPort,
        ids: IdGeneratorPort,
        profiles: Mapping[str, SourceProfile],
        scoring_rules: ScoringRules,
        disposition_rules: DispositionRules,
        correlation_bucket_hours: int = DEFAULT_BUCKET_HOURS,
    ) -> None:
        self._search = search
        self._alerts = alerts
        self._clock = clock
        self._ids = ids
        self._profiles = profiles
        self._scoring_rules = scoring_rules
        self._disposition_rules = disposition_rules
        self._correlation_bucket_hours = correlation_bucket_hours
        self._enrich = EnrichObservablesUseCase(
            threat_intel=threat_intel,
            indicators=indicators,
            allowlist=allowlist,
            clock=clock,
            ids=ids,
        )

    def _profile_for(self, source: str) -> SourceProfile:
        """Return the source's profile, or raise if the source is unknown."""
        profile = self._profiles.get(source)
        if profile is None:
            raise PolicyViolationError(f"no source profile configured for '{source}'")
        return profile

    def _build_alert(
        self,
        event: NormalizedEvent,
        verdict: TriageVerdict,
    ) -> Alert:
        """Project a verdict into an actionable finding.

        The correlation key is computed here, at triage time, so escalation
        never has to reconstruct the event to work out which investigation an
        alert belongs to.
        """
        return Alert(
            alert_id=self._ids.new_id(),
            event_id=event.event_id,
            dedup_key=event.dedup_key,
            correlation_key=correlation_key(event, verdict, self._correlation_bucket_hours),
            title=f"{event.category}: {event.action or 'activity'} on {event.host or 'unknown'}",
            severity=verdict.severity,
            disposition=verdict.disposition,
            score=verdict.score,
            reasons=verdict.reasons,
            observables=verdict.matched or event.observables,
            source=event.source,
            host=event.host,
            asset_criticality=event.asset_criticality,
            occurred_at=event.occurred_at,
            created_at=verdict.decided_at,
            labels=verdict.labels,
        )

    async def _index(self, event: NormalizedEvent) -> None:
        """Hand the event to the search sink, tolerating its absence.

        The sink is not the system of record: failing to index must not undo
        work already committed to our own store.
        """
        try:
            await self._search.index_events([event])
        except IntegrationError:
            return

    async def execute(self, command: IngestEventCommand) -> TriageOutcome:
        """Ingest one raw event and return what triage decided."""
        profile = self._profile_for(command.source)
        received_at = self._clock.now()
        raw = RawEvent(
            source=command.source,
            received_at=received_at,
            payload=command.payload,
            external_id=command.external_id,
        )
        event = normalize(raw, profile, self._ids.new_id())

        enrichments: tuple[EnrichmentResult, ...] = await self._enrich.execute(
            event.observables,
            event_id=event.event_id,
            source=event.source,
        )

        score, severity, reasons = score_event(event, enrichments, self._scoring_rules)
        disposition = decide(event, severity, enrichments, self._disposition_rules)
        matched = tuple(
            e.observable for e in enrichments if e.intel is not None and not e.allowlisted
        )
        verdict = TriageVerdict(
            event_id=event.event_id,
            score=score,
            severity=severity,
            disposition=disposition,
            reasons=reasons,
            matched=matched,
            decided_at=received_at,
            labels=labels_from(enrichments),
        )

        degraded = any(e.degraded for e in enrichments)
        sighted = tuple(str(o) for o in matched)

        if disposition is Disposition.DROP:
            await self._index(event)
            return TriageOutcome(
                event=event,
                verdict=verdict,
                alert=None,
                enrichment_degraded=degraded,
                sighted=sighted,
            )

        existing = await self._alerts.find_by_dedup_key(event.dedup_key)
        if existing is not None:
            await self._index(event)
            return TriageOutcome(
                event=event,
                verdict=verdict,
                alert=existing,
                deduplicated=True,
                enrichment_degraded=degraded,
                sighted=sighted,
            )

        alert = await self._alerts.save(self._build_alert(event, verdict))
        await self._index(event)
        return TriageOutcome(
            event=event,
            verdict=verdict,
            alert=alert,
            enrichment_degraded=degraded,
            sighted=sighted,
        )
