"""Tests for RedactMiddleware: base_fields, metadata, and policy redact_fields."""

from __future__ import annotations

import asyncio

import pytest
from fakes import FakePolicyStore, FakeRedactor

from audit_framework.core.middlewares.audit_policy import AuditPolicyMiddleware
from audit_framework.core.middlewares.redact import RedactMiddleware
from audit_framework.core.models import AuditEvent, AuditPolicy, PipelineContext


def _event() -> AuditEvent:
    return AuditEvent(
        actor_id="a",
        action="UPDATE",
        resource_type="contract",
        resource_id="c-1",
        timestamp="t",
        request_id="r",
        changes={"ssn": {"old": "1", "new": "2"}, "amount": {"old": 1, "new": 2}},
        metadata={"token": "secret", "source": "api"},
    )


async def _run(middleware, context) -> None:
    async def terminal() -> None:
        return None

    await middleware.process(context.event, context, terminal)


def test_base_fields_redact_changes_and_metadata() -> None:
    ctx = PipelineContext(event=_event())
    mw = RedactMiddleware(FakeRedactor(), base_fields=["ssn", "token"])

    asyncio.run(_run(mw, ctx))

    assert ctx.event.changes["ssn"] == "***"  # redacted
    assert ctx.event.changes["amount"] == {"old": 1, "new": 2}  # untouched
    assert ctx.event.metadata["token"] == "***"  # metadata also scrubbed
    assert ctx.event.metadata["source"] == "api"


def test_no_fields_leaves_event_untouched() -> None:
    ctx = PipelineContext(event=_event())
    original = ctx.event
    mw = RedactMiddleware(FakeRedactor(), base_fields=[])

    asyncio.run(_run(mw, ctx))

    assert ctx.event is original  # no dataclasses.replace performed


def test_policy_redact_fields_applied_when_policy_selected() -> None:
    # Recommended order: AuditPolicy selects the policy, then Redact applies its
    # redact_fields. Drives both middlewares over one shared context.
    policy = AuditPolicy(
        name="contracts", match={"action": ["UPDATE"]}, redact_fields=["ssn"]
    )
    store = FakePolicyStore(audit=[policy])
    ctx = PipelineContext(event=_event())

    asyncio.run(_run(AuditPolicyMiddleware(store), ctx))
    assert ctx.audit_policy is policy  # policy now on context

    asyncio.run(_run(RedactMiddleware(FakeRedactor()), ctx))
    assert ctx.event.changes["ssn"] == "***"  # policy-driven redaction took effect


def test_policy_redact_fields_inert_before_policy_selected() -> None:
    # If Redact runs before policy selection, only base_fields apply (documents
    # the ordering requirement the canonical wiring fixes).
    ctx = PipelineContext(event=_event())
    assert ctx.audit_policy is None

    asyncio.run(_run(RedactMiddleware(FakeRedactor(), base_fields=["amount"]), ctx))

    assert ctx.event.changes["amount"] == "***"  # base field redacted
    assert ctx.event.changes["ssn"] == {"old": "1", "new": "2"}  # policy field NOT yet redacted


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
