"""Case state machine and alert absorption.

The transition table is the single source of truth for case lifecycle. It is
declared as data so it can be asserted over directly in tests.
"""

from collections.abc import Mapping
from datetime import datetime

from domain.case_entity import TERMINAL_STATUSES, Case, CaseRef, CaseStatus
from domain.soc_error import ConflictingStateError
from domain.verdict_entity import SEVERITY_RANK, Alert

ALLOWED_TRANSITIONS: Mapping[CaseStatus, frozenset[CaseStatus]] = {
    CaseStatus.OPEN: frozenset(
        {
            CaseStatus.IN_PROGRESS,
            CaseStatus.CONTAINED,
            CaseStatus.CLOSED_RESOLVED,
            CaseStatus.CLOSED_FALSE_POSITIVE,
        }
    ),
    CaseStatus.IN_PROGRESS: frozenset(
        {
            CaseStatus.CONTAINED,
            CaseStatus.CLOSED_RESOLVED,
            CaseStatus.CLOSED_FALSE_POSITIVE,
        }
    ),
    CaseStatus.CONTAINED: frozenset(
        {
            CaseStatus.IN_PROGRESS,
            CaseStatus.CLOSED_RESOLVED,
            CaseStatus.CLOSED_FALSE_POSITIVE,
        }
    ),
    CaseStatus.CLOSED_RESOLVED: frozenset(),
    CaseStatus.CLOSED_FALSE_POSITIVE: frozenset(),
}


def can_transition(current: CaseStatus, target: CaseStatus) -> bool:
    """Return True if moving from one status to another is legal."""
    return target in ALLOWED_TRANSITIONS.get(current, frozenset())


def transition(case: Case, target: CaseStatus, now: datetime) -> Case:
    """Return the case moved to a new status, or raise if that is illegal."""
    if not can_transition(case.status, target):
        raise ConflictingStateError(
            f"cannot move case {case.case_id} from {case.status.value} to {target.value}"
        )
    return Case(
        case_id=case.case_id,
        correlation_key=case.correlation_key,
        title=case.title,
        status=target,
        severity=case.severity,
        alert_ids=case.alert_ids,
        opened_at=case.opened_at,
        updated_at=now,
        closed_at=now if target in TERMINAL_STATUSES else None,
        external_ref=case.external_ref,
    )


def merge_alert(case: Case, alert: Alert, now: datetime) -> Case:
    """Absorb an alert into an existing case.

    Severity ratchets upward only: a later low-severity finding must not
    downgrade an investigation that already saw something worse.
    """
    if case.status in TERMINAL_STATUSES:
        raise ConflictingStateError(f"cannot add alerts to closed case {case.case_id}")
    if alert.alert_id in case.alert_ids:
        return case

    severity = (
        alert.severity
        if SEVERITY_RANK[alert.severity] > SEVERITY_RANK[case.severity]
        else case.severity
    )
    return Case(
        case_id=case.case_id,
        correlation_key=case.correlation_key,
        title=case.title,
        status=case.status,
        severity=severity,
        alert_ids=(*case.alert_ids, alert.alert_id),
        opened_at=case.opened_at,
        updated_at=now,
        closed_at=case.closed_at,
        external_ref=case.external_ref,
    )


def attach_external_ref(case: Case, ref: CaseRef, now: datetime) -> Case:
    """Return the case with an external system reference attached.

    Deliberately separate from case creation: the local case is saved first,
    and the external reference is bolted on afterwards, so an outage in the
    case manager can never lose the investigation.
    """
    return Case(
        case_id=case.case_id,
        correlation_key=case.correlation_key,
        title=case.title,
        status=case.status,
        severity=case.severity,
        alert_ids=case.alert_ids,
        opened_at=case.opened_at,
        updated_at=now,
        closed_at=case.closed_at,
        external_ref=ref,
    )
