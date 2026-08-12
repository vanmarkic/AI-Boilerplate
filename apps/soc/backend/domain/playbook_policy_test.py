"""Playbook selection and idempotency."""

from datetime import UTC, datetime
from uuid import UUID

from domain.event_entity import AssetCriticality, NormalizedEvent
from domain.observable_entity import Observable, ObservableType
from domain.playbook_entity import PlaybookCatalog, PlaybookRule
from domain.playbook_policy import idempotency_key, select
from domain.verdict_entity import Disposition, Severity, TriageVerdict

NOW = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
EVENT_ID = UUID("11111111-1111-1111-1111-111111111111")
IP = Observable(ObservableType.IPV4, "203.0.113.9")
HASH = Observable(ObservableType.SHA256, "a" * 64)

ISOLATE = PlaybookRule(
    playbook_id="isolate-host",
    min_severity=Severity.HIGH,
    dispositions=(Disposition.ESCALATE,),
    priority=100,
)
BLOCK_IP = PlaybookRule(
    playbook_id="block-ip",
    min_severity=Severity.MEDIUM,
    dispositions=(Disposition.ALERT, Disposition.ESCALATE),
    observable_types=(ObservableType.IPV4,),
    priority=50,
)
RANSOMWARE = PlaybookRule(
    playbook_id="ransomware-response",
    min_severity=Severity.MEDIUM,
    dispositions=(Disposition.ESCALATE,),
    required_labels=("ransomware",),
    priority=200,
)
CROWN_ONLY = PlaybookRule(
    playbook_id="crown-jewel-lockdown",
    min_severity=Severity.LOW,
    dispositions=(Disposition.ESCALATE,),
    min_criticality=AssetCriticality.CROWN_JEWEL,
    priority=10,
)

CATALOG = PlaybookCatalog(rules=(ISOLATE, BLOCK_IP, RANSOMWARE, CROWN_ONLY))


def make_event(
    criticality: AssetCriticality = AssetCriticality.STANDARD,
    dedup_key: str = "dedup-1",
) -> NormalizedEvent:
    """Build a normalized event."""
    return NormalizedEvent(
        event_id=EVENT_ID,
        source="test",
        occurred_at=NOW,
        received_at=NOW,
        category="malware",
        action="exec",
        message="",
        host="web01",
        user=None,
        asset_criticality=criticality,
        observables=(IP,),
        dedup_key=dedup_key,
    )


def make_verdict(
    severity: Severity = Severity.HIGH,
    disposition: Disposition = Disposition.ESCALATE,
    matched: tuple[Observable, ...] = (IP,),
    labels: tuple[str, ...] = (),
) -> TriageVerdict:
    """Build a triage verdict."""
    return TriageVerdict(
        event_id=EVENT_ID,
        score=80,
        severity=severity,
        disposition=disposition,
        reasons=(),
        matched=matched,
        decided_at=NOW,
        labels=labels,
    )


class TestSelect:
    """Selection is deterministic: highest priority matching rule wins."""

    def test_dropped_finding_runs_nothing(self) -> None:
        decision = select(
            make_verdict(disposition=Disposition.DROP), make_event(), CATALOG, "alert-1"
        )
        assert not decision.should_run
        assert decision.playbook_id is None
        assert "drop" in decision.reason

    def test_no_matching_rule_runs_nothing(self) -> None:
        decision = select(
            make_verdict(severity=Severity.INFO, disposition=Disposition.MONITOR),
            make_event(),
            CATALOG,
            "alert-1",
        )
        assert not decision.should_run
        assert "no playbook rule matched" in decision.reason

    def test_highest_priority_match_wins(self) -> None:
        decision = select(make_verdict(), make_event(), CATALOG, "alert-1")
        assert decision.playbook_id == "isolate-host"

    def test_label_requirement_promotes_the_specialised_playbook(self) -> None:
        decision = select(make_verdict(labels=("ransomware",)), make_event(), CATALOG, "alert-1")
        assert decision.playbook_id == "ransomware-response"

    def test_label_rule_is_skipped_without_the_label(self) -> None:
        decision = select(make_verdict(labels=("phishing",)), make_event(), CATALOG, "alert-1")
        assert decision.playbook_id == "isolate-host"

    def test_severity_floor_excludes_lower_severity_findings(self) -> None:
        decision = select(
            make_verdict(severity=Severity.MEDIUM, disposition=Disposition.ALERT),
            make_event(),
            CATALOG,
            "alert-1",
        )
        assert decision.playbook_id == "block-ip"

    def test_observable_type_requirement_is_enforced(self) -> None:
        decision = select(
            make_verdict(severity=Severity.MEDIUM, disposition=Disposition.ALERT, matched=(HASH,)),
            make_event(),
            CATALOG,
            "alert-1",
        )
        assert not decision.should_run

    def test_criticality_floor_is_enforced(self) -> None:
        """crown-jewel-lockdown must not fire on a standard asset."""
        catalog = PlaybookCatalog(rules=(CROWN_ONLY,))
        standard = select(make_verdict(), make_event(), catalog, "alert-1")
        assert not standard.should_run

        crown = select(make_verdict(), make_event(AssetCriticality.CROWN_JEWEL), catalog, "alert-1")
        assert crown.playbook_id == "crown-jewel-lockdown"

    def test_decision_carries_inputs_for_the_orchestrator(self) -> None:
        decision = select(make_verdict(), make_event(), CATALOG, "alert-1")
        assert decision.inputs["event_id"] == str(EVENT_ID)
        assert decision.inputs["severity"] == "high"
        assert decision.inputs["host"] == "web01"
        assert "203.0.113.9" in decision.inputs["observables"]

    def test_selection_is_stable_across_calls(self) -> None:
        first = select(make_verdict(), make_event(), CATALOG, "alert-1")
        second = select(make_verdict(), make_event(), CATALOG, "alert-1")
        assert first == second


class TestIdempotencyKey:
    """Our own idempotency guarantee, since orchestrators do not provide one."""

    def test_same_inputs_produce_the_same_key(self) -> None:
        assert idempotency_key("pb", "alert-1", "d") == idempotency_key("pb", "alert-1", "d")

    def test_different_playbook_produces_a_different_key(self) -> None:
        assert idempotency_key("pb-a", "alert-1", "d") != idempotency_key("pb-b", "alert-1", "d")

    def test_different_subject_produces_a_different_key(self) -> None:
        assert idempotency_key("pb", "alert-1", "d") != idempotency_key("pb", "alert-2", "d")

    def test_different_event_produces_a_different_key(self) -> None:
        assert idempotency_key("pb", "alert-1", "d1") != idempotency_key("pb", "alert-1", "d2")

    def test_selection_reuses_the_key_for_a_repeated_finding(self) -> None:
        """A retried event must choose the same key, so it cannot fire twice."""
        first = select(make_verdict(), make_event(dedup_key="same"), CATALOG, "alert-1")
        second = select(make_verdict(), make_event(dedup_key="same"), CATALOG, "alert-1")
        assert first.idempotency_key == second.idempotency_key

    def test_distinct_events_get_distinct_keys(self) -> None:
        first = select(make_verdict(), make_event(dedup_key="a"), CATALOG, "alert-1")
        second = select(make_verdict(), make_event(dedup_key="b"), CATALOG, "alert-1")
        assert first.idempotency_key != second.idempotency_key
