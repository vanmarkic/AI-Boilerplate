"""AuditPolicyMiddleware — decide whether (and how) to record an event.

Evaluates the audit-policy layer (AD-2). If a policy matches, it is attached to
``context.audit_policy`` and the chain continues. If none matches, the context
is halted so the event is neither stored, fanned out, broadcast, nor escalated —
it is simply not audited.
"""

from __future__ import annotations

from audit_framework.core.models import AuditEvent, PipelineContext
from audit_framework.core.pipeline import NextCallable
from audit_framework.core.policy_engine import AuditPolicyEngine
from audit_framework.core.ports import PolicyStore

__all__ = ["AuditPolicyMiddleware"]


class AuditPolicyMiddleware:
    """Selects the governing :class:`AuditPolicy` or halts the pipeline."""

    def __init__(
        self, policy_store: PolicyStore, engine: AuditPolicyEngine | None = None
    ) -> None:
        self._policy_store = policy_store
        self._engine = engine or AuditPolicyEngine()

    async def process(
        self, event: AuditEvent, context: PipelineContext, next: NextCallable
    ) -> None:
        policies = self._policy_store.get_audit_policies()
        policy = self._engine.evaluate(policies, event)
        if policy is None:
            context.halt()
            return
        context.audit_policy = policy
        await next()
