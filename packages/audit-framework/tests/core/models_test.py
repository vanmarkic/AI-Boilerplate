"""Tests for the core domain models: immutability and serialisation."""

from __future__ import annotations

import dataclasses

import pytest

from audit_framework.core.models import (
    AuditEvent,
    AuditPolicy,
    BroadcastPolicy,
    BroadcastTarget,
    EscalationConfig,
    Notification,
    NotificationDirective,
    PipelineContext,
    ThrottleConfig,
)


def _event() -> AuditEvent:
    return AuditEvent(
        actor_id="u1",
        action="UPDATE",
        resource_type="contract",
        resource_id="c1",
        timestamp="2026-06-26T00:00:00+00:00",
        request_id="req-1",
        changes={"amount": {"old": 1, "new": 2}},
        ip_address="10.0.0.1",
        metadata={"source": "api"},
    )


def test_audit_event_is_frozen() -> None:
    event = _event()
    with pytest.raises(dataclasses.FrozenInstanceError):
        event.actor_id = "hacker"  # type: ignore[misc]


def test_audit_event_to_dict_roundtrips_values() -> None:
    d = _event().to_dict()
    assert d["actor_id"] == "u1"
    assert d["changes"] == {"amount": {"old": 1, "new": 2}}
    assert d["ip_address"] == "10.0.0.1"
    # to_dict copies mutable members (mutating the dict must not touch the event)
    event = _event()
    d2 = event.to_dict()
    d2["changes"]["amount"] = "tampered"
    assert event.changes == {"amount": {"old": 1, "new": 2}}


def test_policies_are_frozen() -> None:
    policy = AuditPolicy(name="p", match={"action": ["UPDATE"]})
    with pytest.raises(dataclasses.FrozenInstanceError):
        policy.enabled = False  # type: ignore[misc]

    bpolicy = BroadcastPolicy(name="b", match={})
    with pytest.raises(dataclasses.FrozenInstanceError):
        bpolicy.template = "x"  # type: ignore[misc]


def test_broadcast_policy_to_dict_nests_parts() -> None:
    policy = BroadcastPolicy(
        name="b",
        match={"action": ["DELETE"]},
        targets=[BroadcastTarget(type="role", value="admin", channels=["in_app"])],
        throttle=ThrottleConfig(window_seconds=30, max_per_window=5),
        escalation=EscalationConfig(enabled=True, severity=3, tags=["sec"]),
    )
    d = policy.to_dict()
    assert d["targets"][0]["type"] == "role"
    assert d["throttle"]["max_per_window"] == 5
    assert d["escalation"]["severity"] == 3


def test_notification_directive_is_frozen_notification_is_mutable() -> None:
    directive = NotificationDirective(
        recipient_id="u1",
        channel="in_app",
        template_key="default",
        event=_event(),
        rule_id="r1",
    )
    with pytest.raises(dataclasses.FrozenInstanceError):
        directive.channel = "email"  # type: ignore[misc]

    notification = Notification(
        id="n1",
        audit_event_request_id="req-1",
        rule_id="r1",
        recipient_id="u1",
        channel="in_app",
    )
    notification.status = "delivered"  # mutable by design
    assert notification.to_dict()["status"] == "delivered"


def test_to_dict_deep_copies_nested_mutables() -> None:
    event = _event()
    d = event.to_dict()
    # mutating a NESTED value of the serialised copy must not touch the event
    d["changes"]["amount"]["new"] = "tampered"
    d["metadata"]["source"] = "tampered"
    assert event.changes["amount"]["new"] == 2
    assert event.metadata["source"] == "api"


def test_pipeline_context_halt() -> None:
    ctx = PipelineContext(event=_event())
    assert ctx.halted is False
    ctx.halt()
    assert ctx.halted is True
    assert ctx.to_dict()["halted"] is True


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
