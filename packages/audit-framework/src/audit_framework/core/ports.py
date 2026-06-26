"""Technology-agnostic ports (interfaces) for every external capability.

Every external dependency the framework needs — storage, identity, delivery,
sinks, case management, infrastructure — is expressed here as a
``runtime_checkable`` :class:`typing.Protocol`. The core depends only on these
abstractions; concrete adapters live in plugin packages and are wired in at
runtime via the :class:`~audit_framework.core.plugin_registry.PluginRegistry`.

Zero dependencies beyond the standard library and ``typing``.
"""

from __future__ import annotations

from typing import Any, Optional, Protocol, runtime_checkable

from audit_framework.core.models import (
    AuditEvent,
    AuditPolicy,
    BroadcastPolicy,
    Notification,
    PipelineContext,
)

__all__ = [
    "AuditStore",
    "NotificationStore",
    "PolicyStore",
    "IdentityResolver",
    "ResourceOwnerResolver",
    "NotificationChannel",
    "RealtimePush",
    "ExternalSink",
    "CaseBackend",
    "CaseRepository",
    "AlertPublisher",
    "EventBus",
    "Subscription",
    "TemplateRenderer",
    "ThrottleStore",
    "Redactor",
]


# --------------------------------------------------------------------------- #
# 5.1 Storage                                                                 #
# --------------------------------------------------------------------------- #
@runtime_checkable
class AuditStore(Protocol):
    """Append-only persistence for audit events."""

    async def append(self, context: PipelineContext) -> str:
        """Persist the event in ``context`` and return its new storage id.

        Implementations MUST treat the audit log as append-only — never update
        or delete existing rows.
        """
        ...

    async def query(
        self, filters: dict[str, Any], offset: int = 0, limit: int = 100
    ) -> list[dict[str, Any]]:
        """Return stored events matching ``filters`` (paginated, newest first)."""
        ...

    async def get_by_resource(
        self, resource_type: str, resource_id: str
    ) -> list[dict[str, Any]]:
        """Return all stored events for one resource, in chronological order."""
        ...

    async def health_check(self) -> bool:
        """Return True if the store is reachable and writable."""
        ...


@runtime_checkable
class NotificationStore(Protocol):
    """Persistence for the notification delivery lifecycle."""

    async def save(self, notification: Notification) -> None:
        """Persist a new (typically pending) notification."""
        ...

    async def mark_delivered(self, notification_id: str, delivered_at: str) -> None:
        """Transition a notification to delivered at the given timestamp."""
        ...

    async def mark_failed(self, notification_id: str, error: str) -> None:
        """Transition a notification to failed with an error description."""
        ...

    async def mark_read(self, notification_id: str, recipient_id: str) -> None:
        """Mark a notification read; MUST verify it belongs to ``recipient_id``."""
        ...

    async def get_pending(self, limit: int = 100) -> list[Notification]:
        """Return undelivered notifications for a retry/dispatch worker."""
        ...

    async def get_unread(self, recipient_id: str) -> list[Notification]:
        """Return unread notifications for one recipient (for initial UI load)."""
        ...


@runtime_checkable
class PolicyStore(Protocol):
    """Source of audit and broadcast policies (YAML, DB, or composite)."""

    def get_audit_policies(self) -> list[AuditPolicy]:
        """Return the current set of audit policies (cheap; may be cached)."""
        ...

    def get_broadcast_policies(self) -> list[BroadcastPolicy]:
        """Return the current set of broadcast policies (cheap; may be cached)."""
        ...

    def reload(self) -> None:
        """Re-read policies from the underlying source (hot reload)."""
        ...


# --------------------------------------------------------------------------- #
# 5.2 Identity                                                                #
# --------------------------------------------------------------------------- #
@runtime_checkable
class IdentityResolver(Protocol):
    """Resolves abstract targets (groups, roles) to concrete user ids."""

    async def resolve_group(self, group_id: str) -> list[str]:
        """Return the user ids that are members of ``group_id``."""
        ...

    async def resolve_role(self, role_name: str) -> list[str]:
        """Return the user ids that hold ``role_name``."""
        ...

    async def resolve_user(self, user_id: str) -> list[str]:
        """Return ``[user_id]`` if it exists, else an empty list (passthrough)."""
        ...

    async def get_user_contact(self, user_id: str, channel: str) -> Optional[str]:
        """Return the contact address for ``user_id`` on ``channel`` (or None)."""
        ...


@runtime_checkable
class ResourceOwnerResolver(Protocol):
    """Resolves the owning user(s) of a given domain resource."""

    async def get_owners(self, resource_type: str, resource_id: str) -> list[str]:
        """Return the user ids considered owners of the resource."""
        ...


# --------------------------------------------------------------------------- #
# 5.3 Delivery                                                                #
# --------------------------------------------------------------------------- #
@runtime_checkable
class NotificationChannel(Protocol):
    """Delivers a rendered notification over one transport (email, SMS, ...)."""

    @property
    def channel_name(self) -> str:
        """Stable identifier matched against ``BroadcastTarget.channels``."""
        ...

    async def send(
        self, recipient_id: str, contact: Optional[str], payload: dict[str, Any]
    ) -> None:
        """Deliver ``payload`` to ``recipient_id`` at ``contact``.

        MUST raise on permanent failure so the dispatcher can mark the
        notification failed.
        """
        ...


@runtime_checkable
class RealtimePush(Protocol):
    """Server→client push transport (e.g. SSE connection manager)."""

    async def push_to_user(
        self, user_id: str, event_type: str, payload: dict[str, Any]
    ) -> None:
        """Push an event to a single connected user (no-op if not connected)."""
        ...

    async def broadcast(self, event_type: str, payload: dict[str, Any]) -> None:
        """Push an event to every connected user."""
        ...


# --------------------------------------------------------------------------- #
# 5.4 External sinks                                                          #
# --------------------------------------------------------------------------- #
@runtime_checkable
class ExternalSink(Protocol):
    """Forwards audit events to an external platform (SIEM, file, syslog)."""

    @property
    def sink_name(self) -> str:
        """Stable identifier matched against ``AuditPolicy.sinks``."""
        ...

    async def emit(self, event: AuditEvent, context: PipelineContext) -> None:
        """Forward one event. SHOULD be best-effort; raise to signal failure."""
        ...

    async def health_check(self) -> bool:
        """Return True if the downstream platform is reachable."""
        ...


# --------------------------------------------------------------------------- #
# 5.5 Case management                                                         #
# --------------------------------------------------------------------------- #
@runtime_checkable
class CaseBackend(Protocol):
    """Adapter onto an external case/incident manager (TheHive, Jira, ...)."""

    async def create(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Create a case/incident and return the backend representation."""
        ...

    async def update(self, case_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Apply a partial update to an existing case."""
        ...

    async def get(self, case_id: str) -> Optional[dict[str, Any]]:
        """Fetch a case by id, or None if it does not exist."""
        ...

    async def search(self, query: dict[str, Any]) -> list[dict[str, Any]]:
        """Return cases matching ``query``."""
        ...

    async def add_observable(self, case_id: str, observable: dict[str, Any]) -> None:
        """Attach an observable (IOC, artefact) to a case."""
        ...

    async def add_task(self, case_id: str, task: dict[str, Any]) -> None:
        """Attach a task to a case."""
        ...

    async def transition(self, case_id: str, status: str) -> None:
        """Move a case to a new status (subject to the backend's state machine)."""
        ...


@runtime_checkable
class CaseRepository(Protocol):
    """Local persistence of the case aggregate and its source linkage."""

    async def save(self, case: Any) -> None:
        """Persist (insert or update) a case aggregate."""
        ...

    async def find_by_source_event(self, request_id: str) -> Optional[Any]:
        """Return the case created from a given audit event, if any (dedup)."""
        ...

    async def find_open_by_resource(
        self, resource_type: str, resource_id: str
    ) -> list[Any]:
        """Return open cases linked to one resource."""
        ...


@runtime_checkable
class AlertPublisher(Protocol):
    """Publishes case-domain alerts back onto the event bus."""

    async def publish(self, event_name: str, payload: dict[str, Any]) -> None:
        """Publish a named alert/event with its payload."""
        ...


# --------------------------------------------------------------------------- #
# 5.6 Infrastructure                                                          #
# --------------------------------------------------------------------------- #
@runtime_checkable
class Subscription(Protocol):
    """A handle to an active event-bus subscription."""

    async def receive(self, timeout: Optional[float] = None) -> Optional[dict[str, Any]]:
        """Return the next message, or None on timeout. Raises if closed."""
        ...

    async def close(self) -> None:
        """Release the subscription and any underlying resources."""
        ...


@runtime_checkable
class EventBus(Protocol):
    """Loose-coupling bus between bounded contexts (in-proc or PG/Redis/NATS)."""

    async def publish(self, channel: str, payload: dict[str, Any]) -> None:
        """Publish ``payload`` to all subscribers of ``channel``."""
        ...

    async def subscribe(self, channel: str) -> Subscription:
        """Subscribe to ``channel`` and return a :class:`Subscription`."""
        ...


@runtime_checkable
class TemplateRenderer(Protocol):
    """Renders a notification payload from an event and template key."""

    def render(
        self, template_key: str, event: AuditEvent, channel: str
    ) -> dict[str, Any]:
        """Return the channel-specific payload (subject/body/etc.)."""
        ...


@runtime_checkable
class ThrottleStore(Protocol):
    """Counts events within a sliding window for throttling decisions."""

    async def increment(self, key: str, window_seconds: int) -> int:
        """Increment the counter for ``key`` and return the new window count."""
        ...

    async def get_count(self, key: str) -> int:
        """Return the current count for ``key`` without incrementing."""
        ...


@runtime_checkable
class Redactor(Protocol):
    """Removes or masks sensitive fields from a data mapping."""

    def redact(self, data: dict[str, Any], fields: list[str]) -> dict[str, Any]:
        """Return a copy of ``data`` with ``fields`` masked/removed."""
        ...
