"""Enrich observables against our own indicators and an external intel source.

Local-first: what we already know is authoritative and always available. The
external source is consulted only for gaps, and its failure degrades the answer
rather than failing the caller — an intel outage must never stop ingestion.
"""

from collections.abc import Mapping, Sequence
from uuid import UUID

from application.allowlist_repository_port import AllowlistRepositoryPort
from application.clock_port import ClockPort, IdGeneratorPort
from application.indicator_repository_port import IndicatorRepositoryPort
from application.threat_intel_port import ThreatIntelPort
from domain.allowlist_policy import is_allowlisted
from domain.indicator_entity import Indicator, IndicatorIntel, Sighting
from domain.indicator_policy import from_intel, merge, record_sighting
from domain.observable_entity import Observable
from domain.soc_error import IntegrationError
from domain.verdict_entity import EnrichmentResult


def _as_intel(indicator: Indicator) -> IndicatorIntel:
    """Present an indicator we own in the same shape as an external claim."""
    return IndicatorIntel(
        observable=indicator.observable,
        known=True,
        confidence=indicator.confidence,
        threat_labels=indicator.threat_labels,
        tlp=indicator.tlp,
        first_seen=indicator.first_seen,
        last_seen=indicator.last_seen,
        source=indicator.source,
        source_ref=indicator.external_ref,
    )


class EnrichObservablesUseCase:
    """Answers "what do we know about these artefacts?"."""

    def __init__(
        self,
        *,
        threat_intel: ThreatIntelPort,
        indicators: IndicatorRepositoryPort,
        allowlist: AllowlistRepositoryPort,
        clock: ClockPort,
        ids: IdGeneratorPort,
    ) -> None:
        self._threat_intel = threat_intel
        self._indicators = indicators
        self._allowlist = allowlist
        self._clock = clock
        self._ids = ids

    async def _remote_lookup(
        self,
        observables: Sequence[Observable],
    ) -> tuple[Mapping[Observable, IndicatorIntel], bool]:
        """Consult the external source, reporting degradation instead of raising."""
        if not observables:
            return {}, False
        try:
            return await self._threat_intel.bulk_lookup(observables), False
        except IntegrationError:
            return {}, True

    async def execute(
        self,
        observables: Sequence[Observable],
        *,
        event_id: UUID | None = None,
        source: str = "",
    ) -> tuple[EnrichmentResult, ...]:
        """Return what we know about each observable, in the order given."""
        if not observables:
            return ()

        now = self._clock.now()
        entries = await self._allowlist.list_active(now)

        suppressed = {o for o in observables if is_allowlisted(o, entries, now)}
        to_resolve = [o for o in observables if o not in suppressed]

        held = {i.observable: i for i in await self._indicators.get_many(to_resolve)}
        unknown = [o for o in to_resolve if o not in held]
        remote, degraded = await self._remote_lookup(unknown)

        results: list[EnrichmentResult] = []
        for observable in observables:
            if observable in suppressed:
                results.append(
                    EnrichmentResult(observable=observable, intel=None, allowlisted=True)
                )
                continue

            indicator = held.get(observable)
            claim = remote.get(observable)

            if indicator is not None:
                if claim is not None:
                    indicator = merge(indicator, claim, now)
                indicator = record_sighting(indicator, now)
            elif claim is not None and claim.known:
                indicator = record_sighting(from_intel(claim, self._ids.new_id(), now), now)

            if indicator is None:
                results.append(
                    EnrichmentResult(
                        observable=observable,
                        intel=None,
                        allowlisted=False,
                        degraded=degraded,
                    )
                )
                continue

            await self._indicators.upsert(indicator)
            if event_id is not None:
                await self._indicators.record_sighting(
                    Sighting(
                        sighting_id=self._ids.new_id(),
                        indicator_id=indicator.indicator_id,
                        event_id=event_id,
                        observed_at=now,
                        source=source,
                    )
                )
            results.append(
                EnrichmentResult(
                    observable=observable,
                    intel=_as_intel(indicator),
                    allowlisted=False,
                    degraded=degraded,
                )
            )
        return tuple(results)
