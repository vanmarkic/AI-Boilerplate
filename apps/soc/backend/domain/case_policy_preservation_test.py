"""Each case transformation changes what it says it changes, and nothing else.

``transition``, ``merge_alert`` and ``attach_external_ref`` each promise "the
same case, but with X different". They kept that promise by listing all ten
fields by hand, which type-checks and passes its own tests even when a field is
missing — the omitted one silently reverts to its default.

So the test is not "does field X have the right value" but "is every field this
function did not name still the value it was". That fails on an omission rather
than on a wrong value, which is the failure mode the hand-listing has.
"""

import dataclasses
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from domain.case_entity import Case, CaseRef, CaseStatus
from domain.case_policy import attach_external_ref, merge_alert, transition
from domain.event_entity import AssetCriticality
from domain.observable_entity import Observable, ObservableType
from domain.verdict_entity import Alert, Disposition, Severity

OPENED = datetime(2026, 1, 1, tzinfo=UTC)
LATER = datetime(2026, 6, 1, tzinfo=UTC)
NOW = datetime(2026, 8, 14, tzinfo=UTC)


def populated_case(status: CaseStatus = CaseStatus.IN_PROGRESS) -> Case:
    """A case with every field set to something distinctive.

    Defaults are deliberately avoided: a field that reverts to its default is
    only detectable if it did not start there.
    """
    return Case(
        case_id=uuid4(),
        correlation_key="corr-key-9",
        title="Suspicious login from known C2",
        status=status,
        severity=Severity.HIGH,
        alert_ids=(uuid4(), uuid4()),
        opened_at=OPENED,
        updated_at=LATER,
        closed_at=None,
        external_ref=CaseRef(system="case_management", external_id="99", url="https://x/99"),
    )


def populated_alert(severity: Severity = Severity.LOW) -> Alert:
    return Alert(
        alert_id=uuid4(),
        event_id=uuid4(),
        dedup_key="dedup-1",
        correlation_key="corr-key-9",
        title="A finding",
        severity=severity,
        disposition=Disposition.ALERT,
        score=42,
        reasons=("because",),
        observables=(Observable(ObservableType.IPV4, "198.51.100.7"),),
        source="edr",
        host="web01",
        asset_criticality=AssetCriticality.HIGH,
        occurred_at=OPENED,
        created_at=OPENED,
        case_id=None,
        labels=("c2",),
    )


def _changed_fields(before: object, after: object) -> set[str]:
    """Return the names of every field whose value differs."""
    return {
        f.name
        for f in dataclasses.fields(before)  # type: ignore[arg-type]
        if getattr(before, f.name) != getattr(after, f.name)
    }


class TestTransition:
    """Moving a case's status touches status, updated_at and closed_at."""

    def test_changes_only_the_lifecycle_fields(self) -> None:
        case = populated_case()
        moved = transition(case, CaseStatus.CONTAINED, NOW)
        assert _changed_fields(case, moved) <= {"status", "updated_at", "closed_at"}

    def test_carries_the_external_reference_across(self) -> None:
        """The field most likely to be dropped, and the costliest to lose."""
        case = populated_case()
        assert transition(case, CaseStatus.CONTAINED, NOW).external_ref == case.external_ref

    @pytest.mark.parametrize(
        "target", [CaseStatus.CLOSED_RESOLVED, CaseStatus.CLOSED_FALSE_POSITIVE]
    )
    def test_closing_stamps_closed_at(self, target: CaseStatus) -> None:
        assert transition(populated_case(), target, NOW).closed_at == NOW

    def test_a_non_terminal_move_leaves_closed_at_unset(self) -> None:
        assert transition(populated_case(), CaseStatus.CONTAINED, NOW).closed_at is None


class TestMergeAlert:
    """Absorbing an alert touches the alert list, severity and updated_at."""

    def test_changes_only_what_absorbing_an_alert_implies(self) -> None:
        case = populated_case()
        merged = merge_alert(case, populated_alert(), NOW)
        assert _changed_fields(case, merged) <= {"alert_ids", "severity", "updated_at"}

    def test_severity_ratchets_up_but_never_down(self) -> None:
        case = populated_case()  # HIGH
        assert merge_alert(case, populated_alert(Severity.LOW), NOW).severity is Severity.HIGH
        assert (
            merge_alert(case, populated_alert(Severity.CRITICAL), NOW).severity is Severity.CRITICAL
        )

    def test_the_alert_is_appended_not_replaced(self) -> None:
        case = populated_case()
        alert = populated_alert()
        merged = merge_alert(case, alert, NOW)
        assert merged.alert_ids == (*case.alert_ids, alert.alert_id)


class TestAttachExternalRef:
    """Bolting on the mirror's reference touches the reference and updated_at."""

    def test_changes_only_the_reference_and_the_stamp(self) -> None:
        case = dataclasses.replace(populated_case(), external_ref=None)
        ref = CaseRef(system="case_management", external_id="123", url="https://x/123")
        attached = attach_external_ref(case, ref, NOW)
        assert _changed_fields(case, attached) <= {"external_ref", "updated_at"}

    def test_preserves_a_closed_case_s_closing_time(self) -> None:
        """closed_at has a default of None, so dropping it looks like "never closed"."""
        closed = dataclasses.replace(populated_case(CaseStatus.CLOSED_RESOLVED), closed_at=LATER)
        ref = CaseRef(system="case_management", external_id="123")
        assert attach_external_ref(closed, ref, NOW).closed_at == LATER
