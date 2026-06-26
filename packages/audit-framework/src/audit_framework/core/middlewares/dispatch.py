"""DispatchMiddleware — deliver the produced directives over their channels.

Thin pipeline adapter around :class:`~audit_framework.core.dispatcher.Dispatcher`.
It hands ``context.directives`` to the dispatcher (which renders, persists, and
delivers each notification with per-directive fan-out and failure isolation)
and stores the resulting :class:`Notification` records on ``context.notifications``.
"""

from __future__ import annotations

from audit_framework.core.dispatcher import Dispatcher
from audit_framework.core.models import AuditEvent, PipelineContext
from audit_framework.core.pipeline import NextCallable

__all__ = ["DispatchMiddleware"]


class DispatchMiddleware:
    """Delivers ``context.directives`` via the configured :class:`Dispatcher`."""

    def __init__(self, dispatcher: Dispatcher) -> None:
        self._dispatcher = dispatcher

    async def process(
        self, event: AuditEvent, context: PipelineContext, next: NextCallable
    ) -> None:
        if context.directives:
            notifications = await self._dispatcher.dispatch(context.directives)
            context.notifications.extend(notifications)
        await next()
