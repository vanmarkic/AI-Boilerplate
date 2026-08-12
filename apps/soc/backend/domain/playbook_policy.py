"""Playbook selection and idempotency.

Selection is deterministic: the highest-priority matching rule wins, ties
broken by playbook id. The same finding must always choose the same response.
"""

import hashlib
from collections.abc import Sequence

from domain.event_entity import CRITICALITY_RANK
from domain.observable_entity import Observable
from domain.playbook_entity import PlaybookCatalog, PlaybookDecision, PlaybookRule
from domain.severity_policy import severity_rank
from domain.verdict_entity import Alert, Disposition


def idempotency_key(playbook_id: str, subject_id: str, dedup_key: str) -> str:
    """Return a stable key identifying one intended response action.

    Orchestrators generally offer no idempotency guarantee of their own, so
    this key plus a unique constraint in our store is what stops a retry from
    firing the same containment twice.
    """
    material = f"{playbook_id}|{subject_id}|{dedup_key}"
    return hashlib.sha256(material.encode()).hexdigest()


def _types_of(observables: Sequence[Observable]) -> frozenset[str]:
    """Return the set of observable type names present."""
    return frozenset(o.type.value for o in observables)


def rule_matches(rule: PlaybookRule, alert: Alert, labels: frozenset[str]) -> bool:
    """Return True if a rule applies to this finding."""
    if alert.disposition not in rule.dispositions:
        return False
    if severity_rank(alert.severity) < severity_rank(rule.min_severity):
        return False
    if CRITICALITY_RANK[alert.asset_criticality] < CRITICALITY_RANK[rule.min_criticality]:
        return False
    if rule.required_labels and not labels.issuperset(
        {label.lower() for label in rule.required_labels}
    ):
        return False
    if rule.observable_types:
        wanted = {t.value for t in rule.observable_types}
        if not _types_of(alert.observables).intersection(wanted):
            return False
    return True


def _declined(reason: str) -> PlaybookDecision:
    """A decision not to run anything, with the reason recorded."""
    return PlaybookDecision(
        should_run=False,
        playbook_id=None,
        inputs={},
        reason=reason,
        idempotency_key="",
    )


def select(alert: Alert, catalog: PlaybookCatalog) -> PlaybookDecision:
    """Choose the response for an alert, or decline with a reason.

    Takes the alert rather than an (event, verdict) pair because the alert
    already carries everything selection needs, and it is what actually exists
    at response time.
    """
    if alert.disposition is Disposition.DROP:
        return _declined("disposition is drop")

    labels = frozenset(label.lower() for label in alert.labels)
    candidates = [rule for rule in catalog.rules if rule_matches(rule, alert, labels)]
    if not candidates:
        return _declined("no playbook rule matched")

    winner = sorted(candidates, key=lambda r: (-r.priority, r.playbook_id))[0]
    inputs = {
        "alert_id": str(alert.alert_id),
        "event_id": str(alert.event_id),
        "severity": alert.severity.value,
        "disposition": alert.disposition.value,
        "host": alert.host or "",
        "observables": ",".join(str(o) for o in alert.observables),
    }
    return PlaybookDecision(
        should_run=True,
        playbook_id=winner.playbook_id,
        inputs=inputs,
        reason=f"matched rule '{winner.playbook_id}' (priority {winner.priority})",
        idempotency_key=idempotency_key(winner.playbook_id, str(alert.alert_id), alert.dedup_key),
    )
