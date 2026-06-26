"""EscalationMiddleware — bridge audit events into case management.

For each matching broadcast policy whose :class:`EscalationConfig` is enabled,
emit an ``escalation.requested`` message onto the :class:`EventBus`. The case
management bounded context subscribes to that channel and decides whether to
open a case — the audit pipeline stays ignorant of case internals (loose
coupling via the bus, AD-1).

This middleware re-evaluates broadcast policies through the same engine the
broadcast middleware uses, so escalation does not depend on the broadcast
middleware having run. It does, however, read ``context.stored_id`` (written by
:class:`StoreMiddleware`) to correlate the incident with the persisted audit
row, so place it **after** ``StoreMiddleware`` — otherwise the emitted payload
carries ``stored_id=None`` and the case manager cannot link back to the row.

Note: escalation is intentionally independent of broadcast throttling. Throttle
limits suppress *notification noise*; a security-relevant incident must still
escalate even when notifications are being rate-limited, so this middleware does
not consult the :class:`ThrottleStore`.
"""

from __future__ import annotations

from audit_framework.core.models import AuditEvent, BroadcastPolicy, PipelineContext
from audit_framework.core.pipeline import NextCallable
from audit_framework.core.policy_engine import BroadcastPolicyEngine
from audit_framework.core.ports import EventBus, PolicyStore

__all__ = ["EscalationMiddleware", "ESCALATION_CHANNEL"]

ESCALATION_CHANNEL = "escalation.requested"


class EscalationMiddleware:
    """Publishes escalation requests for policies that opt into escalation."""

    def __init__(
        self,
        event_bus: EventBus,
        policy_store: PolicyStore,
        engine: BroadcastPolicyEngine | None = None,
        channel: str = ESCALATION_CHANNEL,
    ) -> None:
        self._event_bus = event_bus
        self._policy_store = policy_store
        self._engine = engine or BroadcastPolicyEngine()
        self._channel = channel

    async def process(
        self, event: AuditEvent, context: PipelineContext, next: NextCallable
    ) -> None:
        policies = self._policy_store.get_broadcast_policies()
        for policy in self._engine.evaluate(policies, event):
            if policy.escalation and policy.escalation.enabled:
                await self._event_bus.publish(
                    self._channel, self._payload(policy, event, context)
                )
        await next()

    @staticmethod
    def _payload(
        policy: BroadcastPolicy, event: AuditEvent, context: PipelineContext
    ) -> dict:
        esc = policy.escalation
        return {
            "rule_id": policy.name,
            "severity": esc.severity if esc else 2,
            "tags": list(esc.tags) if esc else [],
            "stored_id": context.stored_id,
            "event": event.to_dict(),
        }
