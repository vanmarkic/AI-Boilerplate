"""Routes notification directives to concrete delivery channels.

The :class:`Dispatcher` is the seam between policy evaluation (which produces
:class:`NotificationDirective` objects) and delivery (the
:class:`~audit_framework.core.ports.NotificationChannel` adapters). For each
directive it:

1. renders the channel-specific payload via the :class:`TemplateRenderer`,
2. resolves the recipient's contact address via the :class:`IdentityResolver`,
3. persists a pending :class:`Notification`,
4. delivers it over the matching channel, and
5. records the delivered/failed outcome.

Delivery across directives is fanned out with ``asyncio.gather`` so one slow or
failing channel never blocks the others (best-effort).

Only the standard library and the ports are imported here.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Callable, Optional

from audit_framework.core.models import Notification, NotificationDirective
from audit_framework.core.ports import (
    IdentityResolver,
    NotificationChannel,
    NotificationStore,
    TemplateRenderer,
)

__all__ = ["Dispatcher"]


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Dispatcher:
    """Delivers notification directives over registered channels."""

    def __init__(
        self,
        channels: dict[str, NotificationChannel],
        renderer: TemplateRenderer,
        store: NotificationStore,
        identity: Optional[IdentityResolver] = None,
        *,
        id_factory: Callable[[], str] = lambda: str(uuid.uuid4()),
        clock: Callable[[], str] = _utc_now_iso,
    ) -> None:
        self._channels = dict(channels)
        self._renderer = renderer
        self._store = store
        self._identity = identity
        self._id_factory = id_factory
        self._clock = clock

    def register_channel(self, channel: NotificationChannel) -> None:
        """Register (or replace) a channel under its ``channel_name``."""
        self._channels[channel.channel_name] = channel

    @property
    def channels(self) -> dict[str, NotificationChannel]:
        """The registered channels, keyed by name (read-only copy)."""
        return dict(self._channels)

    async def dispatch(
        self, directives: list[NotificationDirective]
    ) -> list[Notification]:
        """Deliver every directive concurrently; return the notifications.

        Each returned :class:`Notification` reflects the final outcome
        (``delivered`` or ``failed``). Failures are isolated per directive: an
        error in *any* step — rendering, persistence, recipient resolution, or
        channel send — is captured on that directive's own notification and
        never aborts sibling deliveries. ``gather`` runs with
        ``return_exceptions=True`` so a single failure cannot cancel in-flight
        siblings (and to honour the framework's fan-out contract).
        """
        if not directives:
            return []
        results = await asyncio.gather(
            *(self._deliver(d) for d in directives),
            return_exceptions=True,
        )
        # _deliver is total (never raises); the filter is defensive belt-and-braces.
        return [r for r in results if isinstance(r, Notification)]

    async def _deliver(self, directive: NotificationDirective) -> Notification:
        # Build the record first so every failure mode — including a failing
        # render() or store.save() — can be captured on a real Notification
        # rather than escaping and aborting the whole gather batch.
        notification = Notification(
            id=self._id_factory(),
            audit_event_request_id=directive.event.request_id,
            rule_id=directive.rule_id,
            recipient_id=directive.recipient_id,
            channel=directive.channel,
            status="pending",
            payload={},
            created_at=self._clock(),
        )
        try:
            notification.payload = self._renderer.render(
                directive.template_key, directive.event, directive.channel
            )
            await self._store.save(notification)
            channel = self._channels.get(directive.channel)
            if channel is None:
                raise LookupError(f"no channel registered: {directive.channel!r}")
            contact = await self._resolve_contact(directive)
            await channel.send(directive.recipient_id, contact, notification.payload)
        except Exception as exc:  # best-effort: capture, never propagate
            await self._fail(notification, str(exc))
            return notification

        delivered_at = self._clock()
        notification.status = "delivered"
        notification.delivered_at = delivered_at
        await self._store.mark_delivered(notification.id, delivered_at)
        return notification

    async def _resolve_contact(
        self, directive: NotificationDirective
    ) -> Optional[str]:
        if self._identity is None:
            return None
        return await self._identity.get_user_contact(
            directive.recipient_id, directive.channel
        )

    async def _fail(self, notification: Notification, error: str) -> None:
        notification.status = "failed"
        notification.error = error
        try:
            await self._store.mark_failed(notification.id, error)
        except Exception:
            # The returned Notification still reflects the failure even if the
            # store is unreachable or the row was never persisted (e.g. render
            # failed before save). Best-effort, never re-raise.
            pass
