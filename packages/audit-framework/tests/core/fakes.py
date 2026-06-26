"""In-memory fake adapters implementing every port, for stdlib-only tests.

These deliberately have no infrastructure: dicts and lists stand in for
databases, queues, and external systems. They let the full pipeline run
end-to-end in a plain test process.
"""

from __future__ import annotations

from typing import Any, Optional

from audit_framework.core.models import (
    AuditEvent,
    AuditPolicy,
    BroadcastPolicy,
    Notification,
    PipelineContext,
)


class FakeRedactor:
    def redact(self, data: dict[str, Any], fields: list[str]) -> dict[str, Any]:
        out = dict(data)
        for f in fields:
            if f in out:
                out[f] = "***"
        return out


class FakePolicyStore:
    def __init__(
        self,
        audit: list[AuditPolicy] | None = None,
        broadcast: list[BroadcastPolicy] | None = None,
    ) -> None:
        self._audit = list(audit or [])
        self._broadcast = list(broadcast or [])
        self.reloaded = 0

    def get_audit_policies(self) -> list[AuditPolicy]:
        return list(self._audit)

    def get_broadcast_policies(self) -> list[BroadcastPolicy]:
        return list(self._broadcast)

    def reload(self) -> None:
        self.reloaded += 1


class FakeAuditStore:
    def __init__(self) -> None:
        self.appended: list[PipelineContext] = []

    async def append(self, context: PipelineContext) -> str:
        self.appended.append(context)
        return f"row-{len(self.appended)}"

    async def query(
        self, filters: dict[str, Any], offset: int = 0, limit: int = 100
    ) -> list[dict[str, Any]]:
        return [c.event.to_dict() for c in self.appended][offset : offset + limit]

    async def get_by_resource(
        self, resource_type: str, resource_id: str
    ) -> list[dict[str, Any]]:
        return [
            c.event.to_dict()
            for c in self.appended
            if c.event.resource_type == resource_type
            and c.event.resource_id == resource_id
        ]

    async def health_check(self) -> bool:
        return True


class FakeSink:
    def __init__(self, name: str, fail: bool = False) -> None:
        self._name = name
        self._fail = fail
        self.emitted: list[AuditEvent] = []

    @property
    def sink_name(self) -> str:
        return self._name

    async def emit(self, event: AuditEvent, context: PipelineContext) -> None:
        if self._fail:
            raise RuntimeError(f"sink {self._name} down")
        self.emitted.append(event)

    async def health_check(self) -> bool:
        return not self._fail


class FakeIdentityResolver:
    def __init__(
        self,
        roles: dict[str, list[str]] | None = None,
        groups: dict[str, list[str]] | None = None,
        contacts: dict[tuple[str, str], str] | None = None,
    ) -> None:
        self._roles = roles or {}
        self._groups = groups or {}
        self._contacts = contacts or {}

    async def resolve_group(self, group_id: str) -> list[str]:
        return list(self._groups.get(group_id, []))

    async def resolve_role(self, role_name: str) -> list[str]:
        return list(self._roles.get(role_name, []))

    async def resolve_user(self, user_id: str) -> list[str]:
        return [user_id]

    async def get_user_contact(self, user_id: str, channel: str) -> Optional[str]:
        return self._contacts.get((user_id, channel))


class FakeOwnerResolver:
    def __init__(self, owners: dict[tuple[str, str], list[str]] | None = None) -> None:
        self._owners = owners or {}

    async def get_owners(self, resource_type: str, resource_id: str) -> list[str]:
        return list(self._owners.get((resource_type, resource_id), []))


class FakeThrottleStore:
    def __init__(self) -> None:
        self._counts: dict[str, int] = {}

    async def increment(self, key: str, window_seconds: int) -> int:
        self._counts[key] = self._counts.get(key, 0) + 1
        return self._counts[key]

    async def get_count(self, key: str) -> int:
        return self._counts.get(key, 0)


class FakeNotificationStore:
    def __init__(self) -> None:
        self.saved: dict[str, Notification] = {}
        self.delivered: list[str] = []
        self.failed: list[tuple[str, str]] = []
        self.read: list[str] = []

    async def save(self, notification: Notification) -> None:
        self.saved[notification.id] = notification

    async def mark_delivered(self, notification_id: str, delivered_at: str) -> None:
        self.delivered.append(notification_id)

    async def mark_failed(self, notification_id: str, error: str) -> None:
        self.failed.append((notification_id, error))

    async def mark_read(self, notification_id: str, recipient_id: str) -> None:
        self.read.append(notification_id)

    async def get_pending(self, limit: int = 100) -> list[Notification]:
        return [n for n in self.saved.values() if n.status == "pending"][:limit]

    async def get_unread(self, recipient_id: str) -> list[Notification]:
        return [
            n
            for n in self.saved.values()
            if n.recipient_id == recipient_id and n.status != "read"
        ]


class FakeTemplateRenderer:
    def render(
        self, template_key: str, event: AuditEvent, channel: str
    ) -> dict[str, Any]:
        return {
            "template": template_key,
            "channel": channel,
            "title": f"{event.action} {event.resource_type}",
            "resource_id": event.resource_id,
        }


class FakeChannel:
    def __init__(self, name: str, fail: bool = False) -> None:
        self._name = name
        self._fail = fail
        self.sent: list[tuple[str, Optional[str], dict[str, Any]]] = []

    @property
    def channel_name(self) -> str:
        return self._name

    async def send(
        self, recipient_id: str, contact: Optional[str], payload: dict[str, Any]
    ) -> None:
        if self._fail:
            raise RuntimeError(f"channel {self._name} unavailable")
        self.sent.append((recipient_id, contact, payload))


class FakeSubscription:
    def __init__(self, messages: list[dict[str, Any]]) -> None:
        self._messages = list(messages)
        self.closed = False

    async def receive(self, timeout: Optional[float] = None) -> Optional[dict[str, Any]]:
        if self._messages:
            return self._messages.pop(0)
        return None

    async def close(self) -> None:
        self.closed = True


class FakeEventBus:
    def __init__(self) -> None:
        self.published: list[tuple[str, dict[str, Any]]] = []

    async def publish(self, channel: str, payload: dict[str, Any]) -> None:
        self.published.append((channel, payload))

    async def subscribe(self, channel: str) -> FakeSubscription:
        return FakeSubscription([p for c, p in self.published if c == channel])
