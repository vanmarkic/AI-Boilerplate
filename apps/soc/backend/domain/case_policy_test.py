"""Case lifecycle transitions and correlation."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest

from domain.case_entity import Case, CaseRef, CaseStatus
from domain.case_policy import (
    ALLOWED_TRANSITIONS,
    attach_external_ref,
    can_transition,
    merge_alert,
    transition,
)
from domain.correlation_policy import correlation_key, should_open_case
from domain.event_entity import AssetCriticality, NormalizedEvent
from domain.observable_entity import Observable, ObservableType
from domain.soc_error import ConflictingStateError
from domain.verdict_entity import Alert, Disposition, Severity, TriageVerdict

NOW = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
CASE_ID = UUID("22222222-2222-2222-2222-222222222222")
EVENT_ID = UUID("11111111-1111-1111-1111-111111111111")
IP = Observable(ObservableType.IPV4, "203.0.113.9")
DOMAIN = Observable(ObservableType.DOMAIN, "evil.com")


def make_case(status: CaseStatus = CaseStatus.OPEN, severity: Severity = Severity.MEDIUM) -> Case:
    """Build a case in a given state."""
    return Case(
        case_id=CASE_ID,
        correlation_key="key",
        title="Suspicious activity",
        status=status,
        severity=severity,
        alert_ids=(),
        opened_at=NOW,
        updated_at=NOW,
    )


def make_alert(alert_id: UUID, severity: Severity = Severity.HIGH) -> Alert:
    """Build an alert with a given id and severity."""
    return Alert(
        alert_id=alert_id,
        event_id=EVENT_ID,
        dedup_key="d",
        correlation_key="corr",
        title="t",
        severity=severity,
        disposition=Disposition.ESCALATE,
        score=75,
        reasons=(),
        observables=(IP,),
        source="test",
        host="web01",
        asset_criticality=AssetCriticality.STANDARD,
        occurred_at=NOW,
        created_at=NOW,
    )


def make_event(host: str = "web01", occurred_at: datetime = NOW) -> NormalizedEvent:
    """Build a normalized event for correlation."""
    return NormalizedEvent(
        event_id=EVENT_ID,
        source="test",
        occurred_at=occurred_at,
        received_at=occurred_at,
        category="malware",
        action="exec",
        message="",
        host=host,
        user=None,
        asset_criticality=AssetCriticality.STANDARD,
        observables=(IP, DOMAIN),
        dedup_key="d",
    )


def make_verdict(
    matched: tuple[Observable, ...] = (IP, DOMAIN),
    disposition: Disposition = Disposition.ESCALATE,
) -> TriageVerdict:
    """Build a verdict with given matched observables."""
    return TriageVerdict(
        event_id=EVENT_ID,
        score=80,
        severity=Severity.HIGH,
        disposition=disposition,
        reasons=(),
        matched=matched,
        decided_at=NOW,
    )


class TestTransitionTable:
    """Closed cases are terminal; everything else can still move."""

    def test_closed_states_have_no_exits(self) -> None:
        assert ALLOWED_TRANSITIONS[CaseStatus.CLOSED_RESOLVED] == frozenset()
        assert ALLOWED_TRANSITIONS[CaseStatus.CLOSED_FALSE_POSITIVE] == frozenset()

    def test_every_status_is_declared(self) -> None:
        assert set(ALLOWED_TRANSITIONS) == set(CaseStatus)

    @pytest.mark.parametrize(
        ("current", "target"),
        [
            (CaseStatus.OPEN, CaseStatus.IN_PROGRESS),
            (CaseStatus.OPEN, CaseStatus.CLOSED_RESOLVED),
            (CaseStatus.IN_PROGRESS, CaseStatus.CONTAINED),
            (CaseStatus.CONTAINED, CaseStatus.IN_PROGRESS),
        ],
    )
    def test_legal_moves(self, current: CaseStatus, target: CaseStatus) -> None:
        assert can_transition(current, target)

    @pytest.mark.parametrize(
        ("current", "target"),
        [
            (CaseStatus.CLOSED_RESOLVED, CaseStatus.OPEN),
            (CaseStatus.CLOSED_FALSE_POSITIVE, CaseStatus.IN_PROGRESS),
            (CaseStatus.OPEN, CaseStatus.OPEN),
        ],
    )
    def test_illegal_moves(self, current: CaseStatus, target: CaseStatus) -> None:
        assert not can_transition(current, target)


class TestTransition:
    """Transitioning stamps the clock and closes out terminal states."""

    def test_moves_status_and_updates_timestamp(self) -> None:
        later = NOW + timedelta(hours=1)
        moved = transition(make_case(), CaseStatus.IN_PROGRESS, later)
        assert moved.status is CaseStatus.IN_PROGRESS
        assert moved.updated_at == later
        assert moved.closed_at is None

    def test_closing_sets_closed_at(self) -> None:
        closed = transition(make_case(), CaseStatus.CLOSED_RESOLVED, NOW)
        assert closed.closed_at == NOW

    def test_illegal_transition_raises(self) -> None:
        closed = make_case(CaseStatus.CLOSED_RESOLVED)
        with pytest.raises(ConflictingStateError):
            transition(closed, CaseStatus.OPEN, NOW)


class TestMergeAlert:
    """Cases absorb alerts, and severity only ever ratchets up."""

    def test_adds_the_alert_id(self) -> None:
        alert = make_alert(UUID(int=1))
        merged = merge_alert(make_case(), alert, NOW)
        assert merged.alert_ids == (alert.alert_id,)

    def test_is_idempotent_for_the_same_alert(self) -> None:
        alert = make_alert(UUID(int=1))
        once = merge_alert(make_case(), alert, NOW)
        twice = merge_alert(once, alert, NOW)
        assert twice.alert_ids == (alert.alert_id,)

    def test_higher_severity_alert_raises_case_severity(self) -> None:
        case = make_case(severity=Severity.LOW)
        merged = merge_alert(case, make_alert(UUID(int=1), Severity.CRITICAL), NOW)
        assert merged.severity is Severity.CRITICAL

    def test_lower_severity_alert_does_not_downgrade_the_case(self) -> None:
        case = make_case(severity=Severity.CRITICAL)
        merged = merge_alert(case, make_alert(UUID(int=1), Severity.LOW), NOW)
        assert merged.severity is Severity.CRITICAL

    def test_closed_case_rejects_new_alerts(self) -> None:
        closed = make_case(CaseStatus.CLOSED_RESOLVED)
        with pytest.raises(ConflictingStateError):
            merge_alert(closed, make_alert(UUID(int=1)), NOW)


class TestAttachExternalRef:
    """The external reference is bolted on after the local case exists."""

    def test_attaches_and_preserves_everything_else(self) -> None:
        ref = CaseRef(system="case_manager", external_id="42", url="http://x/42")
        case = make_case()
        attached = attach_external_ref(case, ref, NOW)
        assert attached.external_ref == ref
        assert attached.case_id == case.case_id
        assert attached.status is case.status


class TestCorrelationKey:
    """Correlation groups the same campaign on the same host into one case."""

    def test_is_order_insensitive_over_observables(self) -> None:
        forward = correlation_key(make_event(), make_verdict((IP, DOMAIN)))
        reversed_ = correlation_key(make_event(), make_verdict((DOMAIN, IP)))
        assert forward == reversed_

    def test_is_stable_for_repeated_observables(self) -> None:
        once = correlation_key(make_event(), make_verdict((IP,)))
        twice = correlation_key(make_event(), make_verdict((IP, IP)))
        assert once == twice

    def test_differs_by_host(self) -> None:
        a = correlation_key(make_event("web01"), make_verdict())
        b = correlation_key(make_event("web02"), make_verdict())
        assert a != b

    def test_same_time_bucket_correlates(self) -> None:
        a = correlation_key(make_event(occurred_at=NOW), make_verdict())
        b = correlation_key(make_event(occurred_at=NOW + timedelta(hours=2)), make_verdict())
        assert a == b

    def test_different_time_bucket_does_not_correlate(self) -> None:
        a = correlation_key(make_event(occurred_at=NOW), make_verdict())
        b = correlation_key(make_event(occurred_at=NOW + timedelta(days=5)), make_verdict())
        assert a != b


class TestShouldOpenCase:
    """Only escalations open cases, and only when none is already open."""

    def test_escalation_with_no_existing_case_opens_one(self) -> None:
        assert should_open_case(make_verdict(), None)

    def test_non_escalation_never_opens_a_case(self) -> None:
        assert not should_open_case(make_verdict(disposition=Disposition.ALERT), None)

    def test_open_case_absorbs_instead_of_opening_another(self) -> None:
        assert not should_open_case(make_verdict(), make_case(CaseStatus.OPEN))

    def test_closed_case_does_not_block_a_new_one(self) -> None:
        assert should_open_case(make_verdict(), make_case(CaseStatus.CLOSED_RESOLVED))
