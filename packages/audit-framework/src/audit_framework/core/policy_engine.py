"""Policy matching and evaluation.

Two independent policy layers are evaluated per event (AD-2):

* :class:`AuditPolicyEngine` — *should I record this, and how?*
* :class:`BroadcastPolicyEngine` — *should I notify, and whom?*

:class:`PolicyMatcher` holds the (deliberately simple) match logic shared by
both. The ``match`` mapping is a field-name → expected-value(s) dict; a policy
matches an event when **every** field constraint is satisfied. A constraint is
satisfied when the event's value equals the expected scalar, or is contained in
the expected list. This is intentionally a starting point — swap in the
``rule-engine`` expression language at the adapter layer without touching the
engines, which depend only on this matcher.

Zero dependencies beyond the standard library and ``typing``.
"""

from __future__ import annotations

from typing import Any

from audit_framework.core.models import AuditEvent, AuditPolicy, BroadcastPolicy

__all__ = ["PolicyMatcher", "AuditPolicyEngine", "BroadcastPolicyEngine"]


class PolicyMatcher:
    """Static dict-based matching of an event against a ``match`` mapping."""

    @staticmethod
    def matches(match: dict[str, Any], event: AuditEvent) -> bool:
        """Return True when ``event`` satisfies every constraint in ``match``.

        An empty ``match`` matches everything. Unknown field names never match
        (a constraint that can't be evaluated is treated as unsatisfied).
        """
        for field_name, expected in match.items():
            actual = PolicyMatcher._field(event, field_name)
            if not PolicyMatcher._constraint_ok(actual, expected):
                return False
        return True

    @staticmethod
    def _field(event: AuditEvent, name: str) -> Any:
        if hasattr(event, name):
            return getattr(event, name)
        # Allow matching against the extensible metadata bag too.
        return event.metadata.get(name)

    @staticmethod
    def _constraint_ok(actual: Any, expected: Any) -> bool:
        if isinstance(expected, (list, tuple, set)):
            return actual in expected
        return actual == expected


class AuditPolicyEngine:
    """Selects the single audit policy that governs an event."""

    def __init__(self, matcher: PolicyMatcher | None = None) -> None:
        self._matcher = matcher or PolicyMatcher()

    def evaluate(
        self, policies: list[AuditPolicy], event: AuditEvent
    ) -> AuditPolicy | None:
        """Return the highest-priority enabled policy matching ``event``.

        Ties on ``priority`` are broken deterministically by policy name, so
        evaluation is stable regardless of policy ordering. Returns None when
        nothing matches (the event is not audited).
        """
        candidates = [
            p
            for p in policies
            if p.enabled and self._matcher.matches(p.match, event)
        ]
        if not candidates:
            return None
        return max(candidates, key=lambda p: (p.priority, p.name))


class BroadcastPolicyEngine:
    """Selects every broadcast policy that should fire for an event."""

    def __init__(self, matcher: PolicyMatcher | None = None) -> None:
        self._matcher = matcher or PolicyMatcher()

    def evaluate(
        self, policies: list[BroadcastPolicy], event: AuditEvent
    ) -> list[BroadcastPolicy]:
        """Return all enabled matching policies, highest priority first.

        Unlike audit policies (one winner), broadcast policies are additive:
        an event can notify several audiences via several policies at once.
        """
        matching = [
            p
            for p in policies
            if p.enabled and self._matcher.matches(p.match, event)
        ]
        return sorted(matching, key=lambda p: (-p.priority, p.name))
