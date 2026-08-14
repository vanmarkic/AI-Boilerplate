"""Indicator creation and merge.

The merge rule is what makes the threat-intel platform swappable: our record
absorbs what a source claims without ever being owned by it.
"""

from datetime import datetime
from uuid import UUID

from domain.confidence_policy import bump_on_sighting
from domain.indicator_entity import (
    Confidence,
    Indicator,
    IndicatorIntel,
    IndicatorStatus,
)


def from_intel(intel: IndicatorIntel, indicator_id: UUID, now: datetime) -> Indicator:
    """Create an indicator we own from an external claim."""
    return Indicator(
        indicator_id=indicator_id,
        observable=intel.observable,
        confidence=intel.confidence,
        status=IndicatorStatus.ACTIVE,
        threat_labels=tuple(sorted({label.lower() for label in intel.threat_labels})),
        tlp=intel.tlp,
        first_seen=intel.first_seen or now,
        last_seen=intel.last_seen or now,
        sighting_count=0,
        source=intel.source,
        external_ref=intel.source_ref,
    )


def merge(existing: Indicator, intel: IndicatorIntel, now: datetime) -> Indicator:
    """Fold an external claim into an indicator we already hold.

    Confidence takes the maximum rather than the newest: a source lowering its
    score must not silently erase a higher-confidence assessment from another.
    Decay is the only thing allowed to reduce confidence over time.
    """
    if existing.status in (IndicatorStatus.ALLOWLISTED, IndicatorStatus.REVOKED):
        return existing

    labels = tuple(
        sorted({label.lower() for label in (*existing.threat_labels, *intel.threat_labels)})
    )
    first_seen = min(existing.first_seen, intel.first_seen or existing.first_seen)
    last_seen = max(existing.last_seen, intel.last_seen or now)

    return Indicator(
        indicator_id=existing.indicator_id,
        observable=existing.observable,
        confidence=Confidence(value=max(existing.confidence.value, intel.confidence.value)),
        status=IndicatorStatus.ACTIVE,
        threat_labels=labels,
        tlp=intel.tlp if intel.known else existing.tlp,
        first_seen=first_seen,
        last_seen=last_seen,
        sighting_count=existing.sighting_count,
        source=existing.source,
        external_ref=existing.external_ref or intel.source_ref,
    )


def record_sighting(indicator: Indicator, seen_at: datetime) -> Indicator:
    """Return the indicator updated for one new local sighting."""
    count = indicator.sighting_count + 1
    return Indicator(
        indicator_id=indicator.indicator_id,
        observable=indicator.observable,
        confidence=bump_on_sighting(indicator.confidence, count),
        status=indicator.status,
        threat_labels=indicator.threat_labels,
        tlp=indicator.tlp,
        first_seen=indicator.first_seen,
        last_seen=max(indicator.last_seen, seen_at),
        sighting_count=count,
        source=indicator.source,
        external_ref=indicator.external_ref,
    )
