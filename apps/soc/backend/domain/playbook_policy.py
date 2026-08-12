"""Playbook selection and idempotency.

Selection is deterministic: the highest-priority matching rule wins, ties
broken by playbook id. The same finding must always choose the same response.
"""

import hashlib
from collections.abc import Sequence

from domain.event_entity import CRITICALITY_RANK, NormalizedEvent
from domain.observable_entity import Observable
from domain.playbook_entity import PlaybookCatalog, PlaybookDecision, PlaybookRule
from domain.severity_policy import severity_rank
from domain.verdict_entity import Disposition, TriageVerdict


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


def rule_matches(
    rule: PlaybookRule,
    verdict: TriageVerdict,
    event: NormalizedEvent,
    labels: frozenset[str],
) -> bool:
    """Return True if a rule applies to this finding."""
    if verdict.disposition not in rule.dispositions:
        return False
    if severity_rank(verdict.severity) < severity_rank(rule.min_severity):
        return False
    if CRITICALITY_RANK[event.asset_criticality] < CRITICALITY_RANK[rule.min_criticality]:
        return False
    if rule.required_labels and not labels.issuperset(
        {label.lower() for label in rule.required_labels}
    ):
        return False
    if rule.observable_types:
        wanted = {t.value for t in rule.observable_types}
        if not _types_of(verdict.matched).intersection(wanted):
            return False
    return True


def select(
    verdict: TriageVerdict,
    event: NormalizedEvent,
    catalog: PlaybookCatalog,
    subject_id: str,
) -> PlaybookDecision:
    """Choose the response for a finding, or decline with a reason."""
    if verdict.disposition is Disposition.DROP:
        return PlaybookDecision(
            should_run=False,
            playbook_id=None,
            inputs={},
            reason="disposition is drop",
            idempotency_key="",
        )

    labels = frozenset(label.lower() for label in verdict.labels)
    candidates = [rule for rule in catalog.rules if rule_matches(rule, verdict, event, labels)]
    if not candidates:
        return PlaybookDecision(
            should_run=False,
            playbook_id=None,
            inputs={},
            reason="no playbook rule matched",
            idempotency_key="",
        )

    winner = sorted(candidates, key=lambda r: (-r.priority, r.playbook_id))[0]
    inputs = {
        "event_id": str(event.event_id),
        "severity": verdict.severity.value,
        "disposition": verdict.disposition.value,
        "host": event.host or "",
        "observables": ",".join(str(o) for o in verdict.matched),
    }
    return PlaybookDecision(
        should_run=True,
        playbook_id=winner.playbook_id,
        inputs=inputs,
        reason=f"matched rule '{winner.playbook_id}' (priority {winner.priority})",
        idempotency_key=idempotency_key(winner.playbook_id, subject_id, event.dedup_key),
    )
