"""Core domain models for the audit & notification framework.

Every model is an immutable ``frozen`` dataclass (with the single exception of
:class:`PipelineContext`, which is the mutable bag passed down the middleware
chain) and exposes a ``to_dict()`` method for serialisation.

Zero dependencies beyond the standard library and ``typing``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

__all__ = [
    "AuditEvent",
    "AuditPolicy",
    "BroadcastTarget",
    "ThrottleConfig",
    "EscalationConfig",
    "BroadcastCondition",
    "BroadcastPolicy",
    "NotificationDirective",
    "Notification",
    "PipelineContext",
]


# --------------------------------------------------------------------------- #
# The atomic unit                                                             #
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class AuditEvent:
    """An immutable record of a single auditable action.

    This is the atomic unit that flows through the pipeline. It carries no
    behaviour and no infrastructure knowledge — just the facts of what
    happened.
    """

    actor_id: str
    action: str  # CREATE, READ, UPDATE, DELETE, LOGIN, LOGIN_FAILED, ...
    resource_type: str  # user, contract, case, ...
    resource_id: str
    timestamp: str  # ISO 8601
    request_id: str  # correlation id
    changes: dict[str, Any] = field(default_factory=dict)  # {"field": {"old", "new"}}
    ip_address: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)  # extensible bag

    def to_dict(self) -> dict[str, Any]:
        return {
            "actor_id": self.actor_id,
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "timestamp": self.timestamp,
            "request_id": self.request_id,
            "changes": dict(self.changes),
            "ip_address": self.ip_address,
            "metadata": dict(self.metadata),
        }


# --------------------------------------------------------------------------- #
# Audit policy                                                                #
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class AuditPolicy:
    """Declares whether and how a matching event is recorded."""

    name: str
    match: dict[str, Any]  # {"action": [...], "resource_type": [...]}
    enabled: bool = True
    detail_level: str = "standard"  # basic | standard | full
    capture_changes: bool = True
    capture_request: bool = False
    redact_fields: list[str] = field(default_factory=list)
    retention_days: Optional[int] = None
    sinks: Optional[list[str]] = None  # restrict to specific sinks; None = all
    priority: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "match": dict(self.match),
            "enabled": self.enabled,
            "detail_level": self.detail_level,
            "capture_changes": self.capture_changes,
            "capture_request": self.capture_request,
            "redact_fields": list(self.redact_fields),
            "retention_days": self.retention_days,
            "sinks": list(self.sinks) if self.sinks is not None else None,
            "priority": self.priority,
        }


# --------------------------------------------------------------------------- #
# Broadcast policy and its parts                                              #
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class BroadcastTarget:
    """Who should be notified, and over which channels."""

    type: str  # "role" | "group" | "user" | "resource_owner"
    value: Optional[str] = None
    channels: list[str] = field(default_factory=lambda: ["in_app"])

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "value": self.value,
            "channels": list(self.channels),
        }


@dataclass(frozen=True)
class ThrottleConfig:
    """Rate-limit notifications produced by a broadcast policy."""

    window_seconds: int = 60
    max_per_window: int = 10

    def to_dict(self) -> dict[str, Any]:
        return {
            "window_seconds": self.window_seconds,
            "max_per_window": self.max_per_window,
        }


@dataclass(frozen=True)
class EscalationConfig:
    """Configures escalation of a matching event into case management."""

    enabled: bool = False
    severity: int = 2
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "severity": self.severity,
            "tags": list(self.tags),
        }


@dataclass(frozen=True)
class BroadcastCondition:
    """Optional extra predicate over the event before broadcasting.

    ``expression`` is an opaque string interpreted by the policy engine (e.g. a
    ``rule-engine`` expression). The core only stores and forwards it.
    """

    expression: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"expression": self.expression}


@dataclass(frozen=True)
class BroadcastPolicy:
    """Declares who gets notified when a matching event is audited."""

    name: str
    match: dict[str, Any]
    enabled: bool = True
    targets: list[BroadcastTarget] = field(default_factory=list)
    template: str = "default"
    throttle: Optional[ThrottleConfig] = None
    conditions: Optional[BroadcastCondition] = None
    escalation: Optional[EscalationConfig] = None
    priority: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "match": dict(self.match),
            "enabled": self.enabled,
            "targets": [t.to_dict() for t in self.targets],
            "template": self.template,
            "throttle": self.throttle.to_dict() if self.throttle else None,
            "conditions": self.conditions.to_dict() if self.conditions else None,
            "escalation": self.escalation.to_dict() if self.escalation else None,
            "priority": self.priority,
        }


# --------------------------------------------------------------------------- #
# Notifications                                                               #
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class NotificationDirective:
    """An instruction to deliver one notification, produced by broadcast eval.

    Immutable: it is the output of policy evaluation, consumed by the
    dispatcher. The persisted, mutable record is :class:`Notification`.
    """

    recipient_id: str
    channel: str
    template_key: str
    event: AuditEvent
    rule_id: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "recipient_id": self.recipient_id,
            "channel": self.channel,
            "template_key": self.template_key,
            "event": self.event.to_dict(),
            "rule_id": self.rule_id,
        }


@dataclass
class Notification:
    """A persisted notification with a mutable delivery lifecycle."""

    id: str
    audit_event_request_id: str
    rule_id: str
    recipient_id: str
    channel: str
    status: str = "pending"  # pending | delivered | read | failed
    payload: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""
    delivered_at: Optional[str] = None
    error: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "audit_event_request_id": self.audit_event_request_id,
            "rule_id": self.rule_id,
            "recipient_id": self.recipient_id,
            "channel": self.channel,
            "status": self.status,
            "payload": dict(self.payload),
            "created_at": self.created_at,
            "delivered_at": self.delivered_at,
            "error": self.error,
        }


# --------------------------------------------------------------------------- #
# Pipeline context (the one mutable model)                                     #
# --------------------------------------------------------------------------- #
@dataclass
class PipelineContext:
    """Mutable bag carried through the middleware chain.

    Middlewares read and write fields here to pass state downstream without
    mutating the immutable :class:`AuditEvent`. A middleware sets ``halted`` to
    stop the chain (e.g. when no audit policy matches).
    """

    event: AuditEvent
    halted: bool = False
    # Set by AuditPolicyMiddleware when an audit policy matches.
    audit_policy: Optional[AuditPolicy] = None
    # Id assigned by the store after the event is persisted.
    stored_id: Optional[str] = None
    # Directives produced by BroadcastPolicyMiddleware, consumed by dispatch.
    directives: list[NotificationDirective] = field(default_factory=list)
    # Notifications persisted by the dispatch middleware.
    notifications: list[Notification] = field(default_factory=list)
    # Free-form scratch space for cross-middleware coordination.
    metadata: dict[str, Any] = field(default_factory=dict)

    def halt(self) -> None:
        """Mark the context so the pipeline stops after the current middleware."""
        self.halted = True

    def to_dict(self) -> dict[str, Any]:
        return {
            "event": self.event.to_dict(),
            "halted": self.halted,
            "audit_policy": self.audit_policy.to_dict() if self.audit_policy else None,
            "stored_id": self.stored_id,
            "directives": [d.to_dict() for d in self.directives],
            "notifications": [n.to_dict() for n in self.notifications],
            "metadata": dict(self.metadata),
        }
