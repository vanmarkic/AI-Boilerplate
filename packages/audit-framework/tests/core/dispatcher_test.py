"""Unit tests for the Dispatcher: contact resolution and failure isolation."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

import pytest
from fakes import FakeChannel, FakeIdentityResolver, FakeNotificationStore, FakeTemplateRenderer

from audit_framework.core.dispatcher import Dispatcher
from audit_framework.core.models import AuditEvent, Notification, NotificationDirective


def _counter():
    state = {"n": 0}

    def factory() -> str:
        state["n"] += 1
        return f"notif-{state['n']}"

    return factory


def _event() -> AuditEvent:
    return AuditEvent(
        actor_id="a",
        action="DELETE",
        resource_type="contract",
        resource_id="c-1",
        timestamp="t",
        request_id="req-1",
    )


def _directive(recipient: str, channel: str, template: str = "default") -> NotificationDirective:
    return NotificationDirective(
        recipient_id=recipient,
        channel=channel,
        template_key=template,
        event=_event(),
        rule_id="rule-1",
    )


def test_contact_is_resolved_and_forwarded_to_channel() -> None:
    channel = FakeChannel("email")
    identity = FakeIdentityResolver(contacts={("u1", "email"): "u1@example.com"})
    store = FakeNotificationStore()
    dispatcher = Dispatcher(
        channels={"email": channel},
        renderer=FakeTemplateRenderer(),
        store=store,
        identity=identity,
        id_factory=_counter(),
    )

    notifications = asyncio.run(dispatcher.dispatch([_directive("u1", "email")]))

    assert len(notifications) == 1
    assert notifications[0].status == "delivered"
    # the resolved contact (not None) was forwarded as the 2nd arg to send()
    assert len(channel.sent) == 1
    recipient, contact, payload = channel.sent[0]
    assert recipient == "u1"
    assert contact == "u1@example.com"
    assert payload["channel"] == "email"
    assert store.delivered == ["notif-1"]


def test_missing_channel_marks_failed() -> None:
    store = FakeNotificationStore()
    dispatcher = Dispatcher(
        channels={"in_app": FakeChannel("in_app")},
        renderer=FakeTemplateRenderer(),
        store=store,
        id_factory=_counter(),
    )

    notifications = asyncio.run(dispatcher.dispatch([_directive("u1", "email")]))

    assert notifications[0].status == "failed"
    assert "no channel registered" in notifications[0].error
    assert "email" in notifications[0].error
    # the record was persisted (save happened) then marked failed
    assert store.failed and store.failed[0][0] == "notif-1"


class _RenderBoom:
    def render(self, template_key: str, event: AuditEvent, channel: str) -> dict[str, Any]:
        if template_key == "boom":
            raise ValueError("template not found")
        return {"template": template_key}


def test_render_failure_isolated_does_not_abort_batch() -> None:
    store = FakeNotificationStore()
    dispatcher = Dispatcher(
        channels={"in_app": FakeChannel("in_app")},
        renderer=_RenderBoom(),
        store=store,
        id_factory=_counter(),
    )

    notifications = asyncio.run(
        dispatcher.dispatch(
            [_directive("u1", "in_app", template="boom"), _directive("u2", "in_app", template="ok")]
        )
    )

    by_recipient = {n.recipient_id: n for n in notifications}
    assert by_recipient["u1"].status == "failed"
    assert "template not found" in by_recipient["u1"].error
    # the sibling still went through despite the render failure on u1
    assert by_recipient["u2"].status == "delivered"


class _SaveBoom(FakeNotificationStore):
    async def save(self, notification: Notification) -> None:
        if notification.recipient_id == "bad":
            raise RuntimeError("db down")
        await super().save(notification)


def test_save_failure_isolated_does_not_abort_batch() -> None:
    store = _SaveBoom()
    dispatcher = Dispatcher(
        channels={"in_app": FakeChannel("in_app")},
        renderer=FakeTemplateRenderer(),
        store=store,
        id_factory=_counter(),
    )

    notifications = asyncio.run(
        dispatcher.dispatch([_directive("bad", "in_app"), _directive("good", "in_app")])
    )

    by_recipient = {n.recipient_id: n for n in notifications}
    assert by_recipient["bad"].status == "failed"
    assert "db down" in by_recipient["bad"].error
    assert by_recipient["good"].status == "delivered"


def test_empty_directives_returns_empty() -> None:
    dispatcher = Dispatcher(
        channels={}, renderer=FakeTemplateRenderer(), store=FakeNotificationStore()
    )
    assert asyncio.run(dispatcher.dispatch([])) == []


class _MarkDeliveredBoom(FakeNotificationStore):
    async def mark_delivered(self, notification_id: str, delivered_at: str) -> None:
        raise RuntimeError("delivered-write failed")


def test_mark_delivered_failure_is_captured_not_dropped() -> None:
    # A failure in the post-send mark_delivered() write must be captured on the
    # notification, not escape _deliver and abort the batch.
    dispatcher = Dispatcher(
        channels={"in_app": FakeChannel("in_app")},
        renderer=FakeTemplateRenderer(),
        store=_MarkDeliveredBoom(),
        id_factory=_counter(),
    )

    notifications = asyncio.run(
        dispatcher.dispatch([_directive("u1", "in_app"), _directive("u2", "in_app")])
    )

    assert len(notifications) == 2  # batch not aborted
    assert all(n.status == "failed" for n in notifications)
    assert "delivered-write failed" in notifications[0].error


class _CancelChannel:
    @property
    def channel_name(self) -> str:
        return "in_app"

    async def send(self, recipient_id, contact, payload) -> None:  # type: ignore[no-untyped-def]
        raise asyncio.CancelledError()


def test_cancelled_error_propagates_and_is_not_silently_dropped() -> None:
    # CancelledError is a BaseException, not caught by _deliver; dispatch must
    # propagate it rather than filter it out and lose the directive.
    dispatcher = Dispatcher(
        channels={"in_app": _CancelChannel()},
        renderer=FakeTemplateRenderer(),
        store=FakeNotificationStore(),
        id_factory=_counter(),
    )

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(dispatcher.dispatch([_directive("u1", "in_app")]))


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
