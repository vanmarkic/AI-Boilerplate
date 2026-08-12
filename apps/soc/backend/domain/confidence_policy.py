"""Confidence decay and indicator status transitions.

Confidence ages out on an exponential half-life: intel that nobody has seen
for months should stop driving alerts on its own.
"""

from datetime import datetime

from domain.indicator_entity import (
    CONFIDENCE_MAX,
    Confidence,
    Indicator,
    IndicatorStatus,
)
from domain.rules_entity import DecayRules

SECONDS_PER_DAY = 86_400.0


def _elapsed_days(last_seen: datetime, now: datetime) -> float:
    """Return whole and fractional days between two instants, never negative."""
    delta = (now - last_seen).total_seconds()
    return max(0.0, delta / SECONDS_PER_DAY)


def decay(
    confidence: Confidence,
    last_seen: datetime,
    now: datetime,
    rules: DecayRules,
) -> Confidence:
    """Return confidence aged by exponential half-life decay.

    Within the grace period confidence is untouched, so a freshly-synced
    indicator is not immediately eroded by clock skew between us and the
    intel source.
    """
    days = _elapsed_days(last_seen, now)
    if days <= rules.grace_days or rules.half_life_days <= 0:
        return confidence

    halvings = (days - rules.grace_days) / rules.half_life_days
    decayed = confidence.value * (0.5**halvings)
    floored = max(float(rules.floor_confidence), decayed)
    return Confidence(value=round(floored))


def bump_on_sighting(confidence: Confidence, sighting_count: int) -> Confidence:
    """Raise confidence when we see an indicator in our own telemetry.

    Diminishing returns: the first few sightings matter most, and the bump can
    never carry confidence past the maximum.
    """
    if sighting_count <= 0:
        return confidence
    bump = min(20, 5 * sighting_count)
    return Confidence(value=min(CONFIDENCE_MAX, confidence.value + bump))


def next_status(
    indicator: Indicator,
    now: datetime,
    rules: DecayRules,
) -> IndicatorStatus:
    """Return the status an indicator should hold given its decayed confidence.

    Allowlisted and revoked are terminal decisions a human made; decay never
    overrides them.
    """
    if indicator.status in (IndicatorStatus.ALLOWLISTED, IndicatorStatus.REVOKED):
        return indicator.status
    decayed = decay(indicator.confidence, indicator.last_seen, now, rules)
    if decayed.value < rules.expire_below:
        return IndicatorStatus.EXPIRED
    return IndicatorStatus.ACTIVE
