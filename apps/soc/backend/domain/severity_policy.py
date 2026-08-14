"""Severity scoring.

Additive and fully explainable: every contribution appends a human-readable
reason, so an analyst can always reconstruct a score from the verdict alone.
No threshold is hardcoded — all of them arrive via ``ScoringRules``.
"""

from collections.abc import Sequence

from domain.event_entity import NormalizedEvent
from domain.rules_entity import ScoringRules
from domain.verdict_entity import SEVERITY_RANK, EnrichmentResult, Severity

SCORE_MIN = 0
SCORE_MAX = 100


def severity_rank(severity: Severity) -> int:
    """Return the ordinal rank of a severity, for comparisons."""
    return SEVERITY_RANK[severity]


def labels_from(enrichments: Sequence[EnrichmentResult]) -> tuple[str, ...]:
    """Return the sorted, lowercased threat labels across all intel hits.

    Carried on the verdict so downstream policies read labels as data rather
    than parsing them back out of the human-readable reasons.
    """
    labels: set[str] = set()
    for enrichment in enrichments:
        if enrichment.allowlisted or enrichment.intel is None:
            continue
        labels.update(label.lower() for label in enrichment.intel.threat_labels)
    return tuple(sorted(labels))


def severity_for_score(score: int, rules: ScoringRules) -> Severity:
    """Return the highest severity whose threshold the score meets."""
    result = Severity.INFO
    for severity, floor in rules.severity_thresholds.items():
        if score >= floor and SEVERITY_RANK[severity] >= SEVERITY_RANK[result]:
            result = severity
    return result


def _intel_contributions(
    enrichments: Sequence[EnrichmentResult],
    rules: ScoringRules,
) -> tuple[int, list[str]]:
    """Score the threat-intel signal across all enriched observables."""
    score = 0
    reasons: list[str] = []
    for enrichment in enrichments:
        if enrichment.allowlisted:
            score -= rules.allowlist_penalty
            reasons.append(f"allowlisted {enrichment.observable}: -{rules.allowlist_penalty}")
            continue
        intel = enrichment.intel
        if intel is None or not intel.known:
            continue
        points = intel.confidence.value * rules.intel_weight // 100
        score += points
        reasons.append(
            f"intel hit {enrichment.observable} (conf {intel.confidence.value}): +{points}"
        )
        for label in intel.threat_labels:
            bonus = rules.label_bonus.get(label.lower())
            if bonus:
                score += bonus
                reasons.append(f"threat label '{label}': +{bonus}")
    return score, reasons


def score_event(
    event: NormalizedEvent,
    enrichments: Sequence[EnrichmentResult],
    rules: ScoringRules,
) -> tuple[int, Severity, tuple[str, ...]]:
    """Return (score, severity, reasons) for an event.

    The score is clamped to 0-100 so an allowlist penalty can neutralise a
    finding without producing meaningless negative numbers.
    """
    base = rules.category_base.get(event.category, rules.default_category_score)
    score = base
    reasons = [f"category '{event.category}': +{base}"]

    bonus = rules.criticality_bonus.get(event.asset_criticality, 0)
    if bonus:
        score += bonus
        sign = "+" if bonus > 0 else ""
        reasons.append(f"asset criticality '{event.asset_criticality.value}': {sign}{bonus}")

    intel_score, intel_reasons = _intel_contributions(enrichments, rules)
    score += intel_score
    reasons.extend(intel_reasons)

    if any(e.degraded for e in enrichments):
        reasons.append("threat intel degraded: scored on local data only")

    clamped = max(SCORE_MIN, min(SCORE_MAX, score))
    if clamped != score:
        reasons.append(f"clamped {score} to {clamped}")

    return clamped, severity_for_score(clamped, rules), tuple(reasons)
