"""Confidence decay, indicator merge, and allowlist matching."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest

from domain.allowlist_policy import allowlisted_set, is_allowlisted, matches
from domain.confidence_policy import bump_on_sighting, decay, next_status
from domain.indicator_entity import (
    AllowlistEntry,
    Confidence,
    Indicator,
    IndicatorIntel,
    IndicatorStatus,
    MatchKind,
    TlpLevel,
)
from domain.indicator_policy import from_intel, merge, record_sighting
from domain.observable_entity import Observable, ObservableType
from domain.rules_entity import DecayRules

NOW = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
IND_ID = UUID("33333333-3333-3333-3333-333333333333")
IP = Observable(ObservableType.IPV4, "203.0.113.9")
RULES = DecayRules(half_life_days=30.0, floor_confidence=0, expire_below=10, grace_days=1)


def make_indicator(
    confidence: int = 80,
    status: IndicatorStatus = IndicatorStatus.ACTIVE,
    last_seen: datetime = NOW,
    labels: tuple[str, ...] = ("c2",),
) -> Indicator:
    """Build an indicator we own."""
    return Indicator(
        indicator_id=IND_ID,
        observable=IP,
        confidence=Confidence(confidence),
        status=status,
        threat_labels=labels,
        tlp=TlpLevel.AMBER,
        first_seen=NOW,
        last_seen=last_seen,
        sighting_count=0,
        source="feed_a",
    )


def make_intel(
    confidence: int = 60,
    labels: tuple[str, ...] = ("ransomware",),
    known: bool = True,
) -> IndicatorIntel:
    """Build an external intel claim."""
    return IndicatorIntel(
        observable=IP,
        known=known,
        confidence=Confidence(confidence),
        threat_labels=labels,
        tlp=TlpLevel.RED,
        first_seen=NOW - timedelta(days=10),
        last_seen=NOW,
        source="feed_b",
    )


def entry(
    observable: Observable,
    kind: MatchKind,
    expires: datetime | None = None,
) -> AllowlistEntry:
    """Build an allowlist entry."""
    return AllowlistEntry(
        entry_id=UUID(int=7),
        observable=observable,
        match_kind=kind,
        reason="known good",
        created_by="alice",
        created_at=NOW,
        expires_at=expires,
    )


class TestDecay:
    """Confidence halves every half-life, after a grace period."""

    def test_within_grace_period_nothing_decays(self) -> None:
        assert decay(Confidence(80), NOW, NOW + timedelta(hours=12), RULES).value == 80

    def test_one_half_life_halves_confidence(self) -> None:
        aged = decay(Confidence(80), NOW, NOW + timedelta(days=31), RULES)
        assert aged.value == 40

    def test_two_half_lives_quarter_confidence(self) -> None:
        aged = decay(Confidence(80), NOW, NOW + timedelta(days=61), RULES)
        assert aged.value == 20

    def test_never_falls_below_the_floor(self) -> None:
        rules = DecayRules(half_life_days=1.0, floor_confidence=15, expire_below=5, grace_days=0)
        aged = decay(Confidence(80), NOW, NOW + timedelta(days=365), rules)
        assert aged.value == 15

    def test_future_last_seen_does_not_increase_confidence(self) -> None:
        """Clock skew between us and a feed must never inflate a score."""
        aged = decay(Confidence(50), NOW + timedelta(days=10), NOW, RULES)
        assert aged.value == 50

    def test_decay_is_monotonically_non_increasing(self) -> None:
        previous = 100
        for days in range(0, 200, 7):
            current = decay(Confidence(100), NOW, NOW + timedelta(days=days), RULES).value
            assert current <= previous
            assert 0 <= current <= 100
            previous = current


class TestBumpOnSighting:
    """Seeing an indicator locally raises confidence, with a ceiling."""

    def test_first_sighting_adds_five(self) -> None:
        assert bump_on_sighting(Confidence(50), 1).value == 55

    def test_bump_saturates(self) -> None:
        assert bump_on_sighting(Confidence(50), 100).value == 70

    def test_never_exceeds_maximum(self) -> None:
        assert bump_on_sighting(Confidence(95), 10).value == 100

    def test_zero_sightings_changes_nothing(self) -> None:
        assert bump_on_sighting(Confidence(50), 0).value == 50


class TestNextStatus:
    """Decay expires indicators; human decisions are never overridden."""

    def test_fresh_indicator_stays_active(self) -> None:
        assert next_status(make_indicator(80, last_seen=NOW), NOW, RULES) is IndicatorStatus.ACTIVE

    def test_heavily_decayed_indicator_expires(self) -> None:
        stale = make_indicator(80, last_seen=NOW - timedelta(days=200))
        assert next_status(stale, NOW, RULES) is IndicatorStatus.EXPIRED

    @pytest.mark.parametrize("status", [IndicatorStatus.ALLOWLISTED, IndicatorStatus.REVOKED])
    def test_human_decisions_survive_decay(self, status: IndicatorStatus) -> None:
        stale = make_indicator(80, status=status, last_seen=NOW - timedelta(days=500))
        assert next_status(stale, NOW, RULES) is status


class TestFromIntelAndMerge:
    """Our record absorbs external claims without being owned by them."""

    def test_from_intel_starts_active_with_no_sightings(self) -> None:
        created = from_intel(make_intel(), IND_ID, NOW)
        assert created.status is IndicatorStatus.ACTIVE
        assert created.sighting_count == 0
        assert created.confidence.value == 60

    def test_merge_keeps_the_higher_confidence(self) -> None:
        """A feed lowering its score must not erase a better assessment."""
        merged = merge(make_indicator(confidence=80), make_intel(confidence=30), NOW)
        assert merged.confidence.value == 80

    def test_merge_raises_confidence_when_intel_is_higher(self) -> None:
        merged = merge(make_indicator(confidence=40), make_intel(confidence=90), NOW)
        assert merged.confidence.value == 90

    def test_merge_unions_threat_labels(self) -> None:
        merged = merge(make_indicator(labels=("c2",)), make_intel(labels=("ransomware",)), NOW)
        assert merged.threat_labels == ("c2", "ransomware")

    def test_merge_widens_the_seen_window(self) -> None:
        merged = merge(make_indicator(), make_intel(), NOW)
        assert merged.first_seen == NOW - timedelta(days=10)

    def test_merge_keeps_our_identity(self) -> None:
        merged = merge(make_indicator(), make_intel(), NOW)
        assert merged.indicator_id == IND_ID
        assert merged.source == "feed_a"

    @pytest.mark.parametrize("status", [IndicatorStatus.ALLOWLISTED, IndicatorStatus.REVOKED])
    def test_merge_leaves_human_decisions_alone(self, status: IndicatorStatus) -> None:
        existing = make_indicator(status=status)
        assert merge(existing, make_intel(confidence=99), NOW) == existing

    def test_record_sighting_increments_and_bumps(self) -> None:
        seen = record_sighting(make_indicator(confidence=50), NOW)
        assert seen.sighting_count == 1
        assert seen.confidence.value == 55


class TestAllowlist:
    """Exact, domain-suffix and CIDR matching."""

    def test_exact_match(self) -> None:
        assert matches(entry(IP, MatchKind.EXACT), IP, NOW)

    def test_exact_match_rejects_a_different_value(self) -> None:
        other = Observable(ObservableType.IPV4, "198.51.100.1")
        assert not matches(entry(IP, MatchKind.EXACT), other, NOW)

    def test_domain_suffix_matches_subdomains(self) -> None:
        rule = entry(Observable(ObservableType.DOMAIN, "corp.example"), MatchKind.DOMAIN_SUFFIX)
        assert matches(rule, Observable(ObservableType.DOMAIN, "vpn.corp.example"), NOW)
        assert matches(rule, Observable(ObservableType.DOMAIN, "corp.example"), NOW)

    def test_domain_suffix_does_not_match_a_lookalike(self) -> None:
        rule = entry(Observable(ObservableType.DOMAIN, "corp.example"), MatchKind.DOMAIN_SUFFIX)
        assert not matches(rule, Observable(ObservableType.DOMAIN, "evilcorp.example"), NOW)

    def test_cidr_matches_addresses_inside_the_network(self) -> None:
        rule = entry(Observable(ObservableType.IPV4, "203.0.113.0/24"), MatchKind.CIDR)
        assert matches(rule, IP, NOW)

    def test_cidr_rejects_addresses_outside_the_network(self) -> None:
        rule = entry(Observable(ObservableType.IPV4, "198.51.100.0/24"), MatchKind.CIDR)
        assert not matches(rule, IP, NOW)

    def test_expired_entry_does_not_match(self) -> None:
        expired = entry(IP, MatchKind.EXACT, expires=NOW - timedelta(days=1))
        assert not matches(expired, IP, NOW)

    def test_unexpired_entry_still_matches(self) -> None:
        live = entry(IP, MatchKind.EXACT, expires=NOW + timedelta(days=1))
        assert matches(live, IP, NOW)

    def test_is_allowlisted_across_multiple_entries(self) -> None:
        rules = [
            entry(Observable(ObservableType.DOMAIN, "corp.example"), MatchKind.DOMAIN_SUFFIX),
            entry(Observable(ObservableType.IPV4, "203.0.113.0/24"), MatchKind.CIDR),
        ]
        assert is_allowlisted(IP, rules, NOW)

    def test_allowlisted_set_returns_only_covered_observables(self) -> None:
        other = Observable(ObservableType.IPV4, "198.51.100.1")
        rules = [entry(IP, MatchKind.EXACT)]
        assert allowlisted_set([IP, other], rules, NOW) == frozenset({IP})

    def test_empty_allowlist_matches_nothing(self) -> None:
        assert not is_allowlisted(IP, [], NOW)
