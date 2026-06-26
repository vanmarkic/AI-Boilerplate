"""StoreMiddleware — persist the event to the primary, append-only audit store.

Only writes when an audit policy has been selected (``context.audit_policy`` is
set by :class:`AuditPolicyMiddleware`). The assigned storage id is recorded on
``context.stored_id`` for downstream correlation (e.g. linking notifications to
the stored row).
"""

from __future__ import annotations

from audit_framework.core.models import AuditEvent, PipelineContext
from audit_framework.core.pipeline import NextCallable
from audit_framework.core.ports import AuditStore

__all__ = ["StoreMiddleware"]


class StoreMiddleware:
    """Writes the (sanitised) event via the :class:`AuditStore` port."""

    def __init__(self, store: AuditStore) -> None:
        self._store = store

    async def process(
        self, event: AuditEvent, context: PipelineContext, next: NextCallable
    ) -> None:
        if context.audit_policy is None:
            # No audit decision was made; nothing to persist.
            await next()
            return
        context.stored_id = await self._store.append(context)
        await next()
