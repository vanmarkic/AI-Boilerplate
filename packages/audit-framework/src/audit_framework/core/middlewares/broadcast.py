"""BroadcastPolicyMiddleware — turn an event into notification directives.

Evaluates the broadcast-policy layer (AD-2), independently of the audit layer.
For every matching policy it resolves each :class:`BroadcastTarget` to concrete
recipient ids (via :class:`IdentityResolver` / :class:`ResourceOwnerResolver`),
applies optional throttling (via :class:`ThrottleStore`), and appends one
:class:`NotificationDirective` per recipient-and-channel to ``context.directives``
for the dispatch middleware to deliver.
"""

from __future__ import annotations

from audit_framework.core.models import (
    AuditEvent,
    BroadcastPolicy,
    BroadcastTarget,
    NotificationDirective,
    PipelineContext,
)
from audit_framework.core.pipeline import NextCallable
from audit_framework.core.policy_engine import BroadcastPolicyEngine
from audit_framework.core.ports import (
    IdentityResolver,
    PolicyStore,
    ResourceOwnerResolver,
    ThrottleStore,
)

__all__ = ["BroadcastPolicyMiddleware"]


class BroadcastPolicyMiddleware:
    """Produces :class:`NotificationDirective` objects from broadcast policies."""

    def __init__(
        self,
        policy_store: PolicyStore,
        identity: IdentityResolver,
        owner_resolver: ResourceOwnerResolver | None = None,
        throttle_store: ThrottleStore | None = None,
        engine: BroadcastPolicyEngine | None = None,
    ) -> None:
        self._policy_store = policy_store
        self._identity = identity
        self._owners = owner_resolver
        self._throttle = throttle_store
        self._engine = engine or BroadcastPolicyEngine()

    async def process(
        self, event: AuditEvent, context: PipelineContext, next: NextCallable
    ) -> None:
        policies = self._policy_store.get_broadcast_policies()
        # `seen` spans every policy for this event so two policies targeting the
        # same recipient+channel produce a single notification, not duplicates.
        seen: set[tuple[str, str]] = set()
        for policy in self._engine.evaluate(policies, event):
            await self._apply_policy(policy, event, context, seen)
        await next()

    async def _apply_policy(
        self,
        policy: BroadcastPolicy,
        event: AuditEvent,
        context: PipelineContext,
        seen: set[tuple[str, str]],
    ) -> None:
        for target in policy.targets:
            recipients = await self._resolve_target(target, event)
            for recipient_id in recipients:
                if not recipient_id:
                    continue  # never address an empty/blank recipient
                for channel in target.channels:
                    key = (recipient_id, channel)
                    if key in seen:
                        continue
                    # Throttle per emitted notification: each unique
                    # recipient+channel consumes one slot, so max_per_window
                    # actually caps notification volume across fan-out.
                    if await self._throttled(policy):
                        continue
                    # Claim the dedup slot only once a directive is actually
                    # produced — a throttled (suppressed) notification must NOT
                    # block a different, un-throttled policy from notifying the
                    # same recipient+channel for this event.
                    seen.add(key)
                    context.directives.append(
                        NotificationDirective(
                            recipient_id=recipient_id,
                            channel=channel,
                            template_key=policy.template,
                            event=event,
                            rule_id=policy.name,
                        )
                    )

    async def _resolve_target(
        self, target: BroadcastTarget, event: AuditEvent
    ) -> list[str]:
        if target.type in ("role", "group", "user") and not target.value:
            return []  # a value-less role/group/user target resolves to nobody
        if target.type == "role":
            return await self._identity.resolve_role(target.value or "")
        if target.type == "group":
            return await self._identity.resolve_group(target.value or "")
        if target.type == "user":
            return await self._identity.resolve_user(target.value or "")
        if target.type == "resource_owner":
            if self._owners is None:
                return []
            return await self._owners.get_owners(
                event.resource_type, event.resource_id
            )
        return []

    async def _throttled(self, policy: BroadcastPolicy) -> bool:
        """Consume one throttle slot for a single notification of ``policy``.

        Returns True when this notification exceeds ``max_per_window`` and must
        be suppressed. Called once per emitted notification (not once per event)
        so the cap bounds notification volume, including within a single event's
        fan-out to many recipients.
        """
        if self._throttle is None or policy.throttle is None:
            return False
        cfg = policy.throttle
        count = await self._throttle.increment(
            f"broadcast:{policy.name}", cfg.window_seconds
        )
        return count > cfg.max_per_window
