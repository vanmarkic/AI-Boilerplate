"""End-to-end pipeline tests: all built-in middlewares chained over fakes."""

from __future__ import annotations

import asyncio

import pytest
from fakes import (
    FakeAuditStore,
    FakeChannel,
    FakeEventBus,
    FakeIdentityResolver,
    FakeNotificationStore,
    FakeOwnerResolver,
    FakePolicyStore,
    FakeRedactor,
    FakeSink,
    FakeTemplateRenderer,
    FakeThrottleStore,
)

from audit_framework.core.dispatcher import Dispatcher
from audit_framework.core.middlewares import (
    AuditPolicyMiddleware,
    BroadcastPolicyMiddleware,
    DispatchMiddleware,
    EscalationMiddleware,
    RedactMiddleware,
    SinkFanOutMiddleware,
    StoreMiddleware,
)
from audit_framework.core.middlewares.escalation import ESCALATION_CHANNEL
from audit_framework.core.models import (
    AuditEvent,
    AuditPolicy,
    BroadcastPolicy,
    BroadcastTarget,
    EscalationConfig,
    ThrottleConfig,
)
from audit_framework.core.pipeline import Pipeline


def _event(action: str = "DELETE", **changes) -> AuditEvent:
    return AuditEvent(
        actor_id="actor-1",
        action=action,
        resource_type="contract",
        resource_id="c-42",
        timestamp="2026-06-26T00:00:00+00:00",
        request_id="req-99",
        changes=changes or {"ssn": {"old": "111", "new": "222"}},
    )


def _build(policy_store, *, sinks, identity, owners, throttle, notif_store, bus):
    dispatcher = Dispatcher(
        channels={"in_app": FakeChannel("in_app")},
        renderer=FakeTemplateRenderer(),
        store=notif_store,
        identity=identity,
        id_factory=_counter(),
    )
    pipeline = (
        Pipeline()
        .use(AuditPolicyMiddleware(policy_store))
        .use(RedactMiddleware(FakeRedactor()))  # placed after policy → uses redact_fields
        .use(StoreMiddleware(FakeAuditStore()))
        .use(SinkFanOutMiddleware(sinks))
        .use(BroadcastPolicyMiddleware(policy_store, identity, owners, throttle))
        .use(DispatchMiddleware(dispatcher))
        .use(EscalationMiddleware(bus, policy_store))
    )
    return pipeline, dispatcher


def _counter():
    state = {"n": 0}

    def factory() -> str:
        state["n"] += 1
        return f"notif-{state['n']}"

    return factory


def _full_policy_store() -> FakePolicyStore:
    audit = [
        AuditPolicy(
            name="contract-writes",
            match={"action": ["CREATE", "UPDATE", "DELETE"]},
            redact_fields=["ssn"],
            sinks=["jsonl"],
        )
    ]
    broadcast = [
        BroadcastPolicy(
            name="notify-admins",
            match={"action": ["DELETE"]},
            targets=[BroadcastTarget(type="role", value="admin", channels=["in_app"])],
            escalation=EscalationConfig(enabled=True, severity=3, tags=["contract"]),
        )
    ]
    return FakePolicyStore(audit=audit, broadcast=broadcast)


def test_full_pipeline_happy_path() -> None:
    store = _full_policy_store()
    sink = FakeSink("jsonl")
    other_sink = FakeSink("splunk")
    identity = FakeIdentityResolver(roles={"admin": ["u1", "u2"]})
    notif_store = FakeNotificationStore()
    bus = FakeEventBus()

    pipeline, _ = _build(
        store,
        sinks=[sink, other_sink],
        identity=identity,
        owners=FakeOwnerResolver(),
        throttle=FakeThrottleStore(),
        notif_store=notif_store,
        bus=bus,
    )

    ctx = asyncio.run(pipeline.execute(_event()))

    # audit policy selected + event persisted
    assert ctx.audit_policy is not None
    assert ctx.audit_policy.name == "contract-writes"
    assert ctx.stored_id is not None

    # redaction applied (ssn masked) and visible downstream
    assert ctx.event.changes["ssn"] == "***"

    # per-policy sink filtering: only "jsonl" got the event
    assert len(sink.emitted) == 1
    assert other_sink.emitted == []

    # two admins → two directives → two delivered notifications
    assert len(ctx.directives) == 2
    assert len(ctx.notifications) == 2
    assert all(n.status == "delivered" for n in ctx.notifications)
    assert len(notif_store.delivered) == 2

    # escalation emitted onto the bus
    assert len(bus.published) == 1
    channel, payload = bus.published[0]
    assert channel == ESCALATION_CHANNEL
    assert payload["severity"] == 3
    assert payload["rule_id"] == "notify-admins"


def test_pipeline_halts_when_no_audit_policy_matches() -> None:
    store = FakePolicyStore(audit=[AuditPolicy(name="logins", match={"action": ["LOGIN"]})])
    sink = FakeSink("jsonl")
    bus = FakeEventBus()
    notif_store = FakeNotificationStore()

    pipeline, _ = _build(
        store,
        sinks=[sink],
        identity=FakeIdentityResolver(),
        owners=FakeOwnerResolver(),
        throttle=FakeThrottleStore(),
        notif_store=notif_store,
        bus=bus,
    )

    ctx = asyncio.run(pipeline.execute(_event(action="DELETE")))

    assert ctx.halted is True
    assert ctx.audit_policy is None
    assert ctx.stored_id is None
    assert sink.emitted == []
    assert ctx.notifications == []
    assert bus.published == []


def test_sink_failure_is_isolated_and_recorded() -> None:
    store = FakePolicyStore(
        audit=[AuditPolicy(name="all", match={})],
        broadcast=[],
    )
    good = FakeSink("good")
    bad = FakeSink("bad", fail=True)
    bus = FakeEventBus()

    pipeline, _ = _build(
        store,
        sinks=[good, bad],
        identity=FakeIdentityResolver(),
        owners=FakeOwnerResolver(),
        throttle=FakeThrottleStore(),
        notif_store=FakeNotificationStore(),
        bus=bus,
    )

    ctx = asyncio.run(pipeline.execute(_event()))

    # good sink still received the event despite bad sink raising
    assert len(good.emitted) == 1
    assert "sink_failures" in ctx.metadata
    assert "bad" in ctx.metadata["sink_failures"]


def test_throttle_suppresses_excess_broadcasts() -> None:
    broadcast = [
        BroadcastPolicy(
            name="noisy",
            match={},
            targets=[BroadcastTarget(type="role", value="admin", channels=["in_app"])],
            throttle=ThrottleConfig(window_seconds=60, max_per_window=1),
        )
    ]
    store = FakePolicyStore(audit=[AuditPolicy(name="all", match={})], broadcast=broadcast)
    identity = FakeIdentityResolver(roles={"admin": ["u1"]})
    throttle = FakeThrottleStore()
    notif_store = FakeNotificationStore()

    pipeline, _ = _build(
        store,
        sinks=[],
        identity=identity,
        owners=FakeOwnerResolver(),
        throttle=throttle,
        notif_store=notif_store,
        bus=FakeEventBus(),
    )

    first = asyncio.run(pipeline.execute(_event()))
    second = asyncio.run(pipeline.execute(_event()))

    assert len(first.directives) == 1  # within window
    assert len(second.directives) == 0  # throttled out


def test_resource_owner_target_resolution() -> None:
    broadcast = [
        BroadcastPolicy(
            name="notify-owner",
            match={},
            targets=[BroadcastTarget(type="resource_owner", channels=["in_app"])],
        )
    ]
    store = FakePolicyStore(audit=[AuditPolicy(name="all", match={})], broadcast=broadcast)
    owners = FakeOwnerResolver(owners={("contract", "c-42"): ["owner-7"]})
    notif_store = FakeNotificationStore()

    pipeline, _ = _build(
        store,
        sinks=[],
        identity=FakeIdentityResolver(),
        owners=owners,
        throttle=FakeThrottleStore(),
        notif_store=notif_store,
        bus=FakeEventBus(),
    )

    ctx = asyncio.run(pipeline.execute(_event()))
    assert len(ctx.directives) == 1
    assert ctx.directives[0].recipient_id == "owner-7"


def test_channel_failure_marks_notification_failed() -> None:
    dispatcher = Dispatcher(
        channels={"in_app": FakeChannel("in_app", fail=True)},
        renderer=FakeTemplateRenderer(),
        store=FakeNotificationStore(),
        id_factory=_counter(),
    )
    broadcast = [
        BroadcastPolicy(
            name="notify",
            match={},
            targets=[BroadcastTarget(type="role", value="admin", channels=["in_app"])],
        )
    ]
    store = FakePolicyStore(audit=[AuditPolicy(name="all", match={})], broadcast=broadcast)
    identity = FakeIdentityResolver(roles={"admin": ["u1"]})

    pipeline = (
        Pipeline()
        .use(AuditPolicyMiddleware(store))
        .use(BroadcastPolicyMiddleware(store, identity))
        .use(DispatchMiddleware(dispatcher))
    )

    ctx = asyncio.run(pipeline.execute(_event()))
    assert len(ctx.notifications) == 1
    assert ctx.notifications[0].status == "failed"
    assert ctx.notifications[0].error


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
