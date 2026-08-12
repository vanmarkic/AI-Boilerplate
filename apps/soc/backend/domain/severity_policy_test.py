"""Severity scoring and disposition decisioning."""

from datetime import UTC, datetime
from uuid import UUID

import pytest

from domain.disposition_policy import decide
from domain.event_entity import AssetCriticality, NormalizedEvent
from domain.indicator_entity import Confidence, IndicatorIntel, TlpLevel
from domain.observable_entity import Observable, ObservableType
from domain.rules_entity import (
    DEFAULT_DISPOSITION_RULES,
    DEFAULT_SCORING_RULES,
    ScoringRules,
)
from domain.severity_policy import (
    labels_from,
    score_event,
    severity_for_score,
)
from domain.verdict_entity import Disposition, EnrichmentResult, Severity

NOW = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
EVENT_ID = UUID("11111111-1111-1111-1111-111111111111")
BAD_IP = Observable(ObservableType.IPV4, "203.0.113.9")


def make_event(
    category: str = "auth_failure",
    criticality: AssetCriticality = AssetCriticality.STANDARD,
) -> NormalizedEvent:
    """Build a normalized event with only the fields scoring cares about."""
    return NormalizedEvent(
        event_id=EVENT_ID,
        source="test",
        occurred_at=NOW,
        received_at=NOW,
        category=category,
        action="login",
        message="",
        host="web01",
        user="alice",
        asset_criticality=criticality,
        observables=(BAD_IP,),
        dedup_key="abc",
    )


def intel(confidence: int, *labels: str) -> IndicatorIntel:
    """Build an intel hit with a given confidence and threat labels."""
    return IndicatorIntel(
        observable=BAD_IP,
        known=True,
        confidence=Confidence(confidence),
        threat_labels=labels,
        tlp=TlpLevel.AMBER,
        first_seen=NOW,
        last_seen=NOW,
        source="test",
    )


def hit(confidence: int, *labels: str) -> EnrichmentResult:
    """An observable that matched threat intel."""
    return EnrichmentResult(observable=BAD_IP, intel=intel(confidence, *labels), allowlisted=False)


MISS = EnrichmentResult(observable=BAD_IP, intel=None, allowlisted=False)
ALLOWED = EnrichmentResult(observable=BAD_IP, intel=None, allowlisted=True)


class TestSeverityForScore:
    """Scores map onto severity bands at their configured floors."""

    @pytest.mark.parametrize(
        ("score", "expected"),
        [
            (0, Severity.INFO),
            (19, Severity.INFO),
            (20, Severity.LOW),
            (44, Severity.LOW),
            (45, Severity.MEDIUM),
            (69, Severity.MEDIUM),
            (70, Severity.HIGH),
            (89, Severity.HIGH),
            (90, Severity.CRITICAL),
            (100, Severity.CRITICAL),
        ],
    )
    def test_bands(self, score: int, expected: Severity) -> None:
        assert severity_for_score(score, DEFAULT_SCORING_RULES) == expected


class TestScoreEvent:
    """Scoring is additive, explainable and clamped."""

    def test_category_alone_sets_the_base_score(self) -> None:
        score, severity, _ = score_event(make_event("auth_failure"), [], DEFAULT_SCORING_RULES)
        assert score == 20
        assert severity is Severity.LOW

    def test_unknown_category_uses_the_default_score(self) -> None:
        score, _, _ = score_event(make_event("something_new"), [], DEFAULT_SCORING_RULES)
        assert score == DEFAULT_SCORING_RULES.default_category_score

    def test_crown_jewel_asset_adds_its_bonus(self) -> None:
        score, _, _ = score_event(
            make_event("auth_failure", AssetCriticality.CROWN_JEWEL), [], DEFAULT_SCORING_RULES
        )
        assert score == 45

    def test_intel_hit_adds_confidence_weighted_points(self) -> None:
        # base 20 + (80 confidence * 50 weight // 100) = 20 + 40
        score, _, _ = score_event(make_event(), [hit(80)], DEFAULT_SCORING_RULES)
        assert score == 60

    def test_threat_label_adds_its_bonus(self) -> None:
        # base 20 + 40 intel + 30 ransomware
        score, _, _ = score_event(make_event(), [hit(80, "ransomware")], DEFAULT_SCORING_RULES)
        assert score == 90

    def test_intel_miss_contributes_nothing(self) -> None:
        score, _, _ = score_event(make_event(), [MISS], DEFAULT_SCORING_RULES)
        assert score == 20

    def test_allowlisted_observable_subtracts_the_penalty(self) -> None:
        score, severity, _ = score_event(make_event("malware"), [ALLOWED], DEFAULT_SCORING_RULES)
        assert score == 0
        assert severity is Severity.INFO

    def test_score_is_clamped_to_the_maximum(self) -> None:
        enrichments = [hit(100, "ransomware", "c2", "apt")]
        score, _, _ = score_event(
            make_event("exfiltration", AssetCriticality.CROWN_JEWEL),
            enrichments,
            DEFAULT_SCORING_RULES,
        )
        assert score == 100

    def test_every_contribution_is_explained(self) -> None:
        _, _, reasons = score_event(
            make_event("malware", AssetCriticality.CROWN_JEWEL),
            [hit(80, "ransomware")],
            DEFAULT_SCORING_RULES,
        )
        joined = " | ".join(reasons)
        assert "category 'malware'" in joined
        assert "asset criticality 'crown_jewel'" in joined
        assert "intel hit" in joined
        assert "threat label 'ransomware'" in joined

    def test_degraded_enrichment_is_recorded_in_reasons(self) -> None:
        degraded = EnrichmentResult(observable=BAD_IP, intel=None, allowlisted=False, degraded=True)
        _, _, reasons = score_event(make_event(), [degraded], DEFAULT_SCORING_RULES)
        assert any("degraded" in r for r in reasons)

    def test_empty_rules_still_produce_a_verdict(self) -> None:
        """A misconfigured rule set must not crash triage."""
        score, severity, _ = score_event(make_event(), [hit(50)], ScoringRules())
        assert score >= 0
        assert severity is Severity.INFO


class TestLabelsFrom:
    """Threat labels travel as data, not prose."""

    def test_collects_and_sorts_labels(self) -> None:
        assert labels_from([hit(50, "C2", "ransomware")]) == ("c2", "ransomware")

    def test_ignores_allowlisted_and_missing_intel(self) -> None:
        assert labels_from([ALLOWED, MISS]) == ()


class TestDisposition:
    """Disposition follows severity, with a lower bar for crown jewels."""

    @pytest.mark.parametrize(
        ("severity", "expected"),
        [
            (Severity.INFO, Disposition.DROP),
            (Severity.LOW, Disposition.MONITOR),
            (Severity.MEDIUM, Disposition.ALERT),
            (Severity.HIGH, Disposition.ESCALATE),
            (Severity.CRITICAL, Disposition.ESCALATE),
        ],
    )
    def test_standard_asset_thresholds(self, severity: Severity, expected: Disposition) -> None:
        assert decide(make_event(), severity, [MISS], DEFAULT_DISPOSITION_RULES) is expected

    def test_crown_jewel_escalates_one_band_earlier(self) -> None:
        event = make_event(criticality=AssetCriticality.CROWN_JEWEL)
        assert (
            decide(event, Severity.MEDIUM, [MISS], DEFAULT_DISPOSITION_RULES)
            is Disposition.ESCALATE
        )

    def test_fully_allowlisted_finding_is_dropped_regardless_of_severity(self) -> None:
        assert (
            decide(make_event(), Severity.CRITICAL, [ALLOWED], DEFAULT_DISPOSITION_RULES)
            is Disposition.DROP
        )

    def test_partially_allowlisted_finding_is_not_dropped(self) -> None:
        assert (
            decide(make_event(), Severity.HIGH, [ALLOWED, hit(90)], DEFAULT_DISPOSITION_RULES)
            is Disposition.ESCALATE
        )
