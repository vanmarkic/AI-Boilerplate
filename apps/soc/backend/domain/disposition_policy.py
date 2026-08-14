"""Disposition: what we do about a scored event."""

from collections.abc import Sequence

from domain.event_entity import AssetCriticality, NormalizedEvent
from domain.rules_entity import DispositionRules
from domain.severity_policy import severity_rank
from domain.verdict_entity import Disposition, EnrichmentResult, Severity


def _every_observable_allowlisted(enrichments: Sequence[EnrichmentResult]) -> bool:
    """Return True if there was at least one observable and all were allowlisted."""
    return bool(enrichments) and all(e.allowlisted for e in enrichments)


def decide(
    event: NormalizedEvent,
    severity: Severity,
    enrichments: Sequence[EnrichmentResult],
    rules: DispositionRules,
) -> Disposition:
    """Choose a disposition for a scored event.

    Crown-jewel assets escalate at a lower severity floor than everything
    else: the same finding on a critical asset warrants a human sooner.
    """
    if _every_observable_allowlisted(enrichments):
        return Disposition.DROP

    rank = severity_rank(severity)

    if event.asset_criticality is AssetCriticality.CROWN_JEWEL:
        if rank >= severity_rank(rules.crown_jewel_escalates_at):
            return Disposition.ESCALATE

    if rank >= severity_rank(rules.escalate_at):
        return Disposition.ESCALATE
    if rank >= severity_rank(rules.alert_at):
        return Disposition.ALERT
    if rank >= severity_rank(rules.monitor_at):
        return Disposition.MONITOR
    return Disposition.DROP
