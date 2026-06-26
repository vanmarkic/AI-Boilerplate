"""Tests for the @auditable decorator and ambient actor context."""

from __future__ import annotations

import asyncio

import pytest

from audit_framework.core.decorators import (
    auditable,
    reset_actor_context,
    set_actor_context,
    set_pipeline_provider,
)
from audit_framework.core.models import AuditEvent, PipelineContext
from audit_framework.core.pipeline import Pipeline


class _CaptureMiddleware:
    def __init__(self) -> None:
        self.events: list[AuditEvent] = []

    async def process(self, event, context, next):  # type: ignore[no-untyped-def]
        self.events.append(event)
        await next()


def _pipeline_with_capture() -> tuple[Pipeline, _CaptureMiddleware]:
    capture = _CaptureMiddleware()
    pipeline = Pipeline().use(capture)
    return pipeline, capture


def test_auditable_emits_event_after_success() -> None:
    pipeline, capture = _pipeline_with_capture()
    set_pipeline_provider(lambda: pipeline)

    class Service:
        @auditable(action="UPDATE", resource_type="contract", resource_id="contract_id")
        async def update(self, contract_id: str) -> str:
            return "ok"

    try:
        result = asyncio.run(Service().update("c-1"))
    finally:
        set_pipeline_provider(lambda: None)

    assert result == "ok"
    assert len(capture.events) == 1
    event = capture.events[0]
    assert event.action == "UPDATE"
    assert event.resource_type == "contract"
    assert event.resource_id == "c-1"
    assert event.actor_id == "system"  # no ambient actor set


def test_auditable_uses_ambient_actor_and_request() -> None:
    pipeline, capture = _pipeline_with_capture()
    set_pipeline_provider(lambda: pipeline)
    tokens = set_actor_context(actor_id="alice", request_id="req-7", ip_address="1.2.3.4")

    class Service:
        @auditable(action="DELETE", resource_type="user", resource_id="user_id")
        async def delete(self, user_id: str) -> None:
            return None

    try:
        asyncio.run(Service().delete("u-9"))
    finally:
        reset_actor_context(tokens)
        set_pipeline_provider(lambda: None)

    event = capture.events[0]
    assert event.actor_id == "alice"
    assert event.request_id == "req-7"
    assert event.ip_address == "1.2.3.4"
    assert event.resource_id == "u-9"


def test_auditable_not_recorded_when_method_raises() -> None:
    pipeline, capture = _pipeline_with_capture()
    set_pipeline_provider(lambda: pipeline)

    class Service:
        @auditable(action="UPDATE", resource_type="contract", resource_id="cid")
        async def boom(self, cid: str) -> None:
            raise ValueError("nope")

    try:
        with pytest.raises(ValueError):
            asyncio.run(Service().boom("c-1"))
    finally:
        set_pipeline_provider(lambda: None)

    assert capture.events == []  # failure is never audited as a completed action


def test_auditable_resource_id_callable_and_changes() -> None:
    pipeline, capture = _pipeline_with_capture()
    set_pipeline_provider(lambda: pipeline)

    class Service:
        @auditable(
            action="UPDATE",
            resource_type="contract",
            resource_id=lambda bound, result: result["id"],
            changes=lambda bound, result: {"amount": {"new": bound["amount"]}},
            metadata={"source": "test"},
        )
        async def update(self, amount: int) -> dict:
            return {"id": "c-77"}

    try:
        asyncio.run(Service().update(500))
    finally:
        set_pipeline_provider(lambda: None)

    event = capture.events[0]
    assert event.resource_id == "c-77"
    assert event.changes == {"amount": {"new": 500}}
    assert event.metadata == {"source": "test"}


def test_auditable_disabled_when_provider_returns_none() -> None:
    set_pipeline_provider(lambda: None)

    class Service:
        @auditable(action="READ", resource_type="contract", resource_id="cid")
        async def read(self, cid: str) -> str:
            return "value"

    # Method still runs untouched; no pipeline → no error.
    assert asyncio.run(Service().read("c-1")) == "value"


def test_explicit_actor_resolving_to_empty_wins_over_ambient() -> None:
    pipeline, capture = _pipeline_with_capture()
    set_pipeline_provider(lambda: pipeline)
    tokens = set_actor_context(actor_id="ambient-user")

    class Service:
        @auditable(
            action="READ", resource_type="doc", resource_id="doc_id", actor_id="uid"
        )
        async def read(self, doc_id: str, uid: str) -> None:
            return None

    try:
        asyncio.run(Service().read("d-1", uid=""))
    finally:
        reset_actor_context(tokens)
        set_pipeline_provider(lambda: None)

    # explicit (empty) actor override is preserved, NOT replaced by ambient/system
    assert capture.events[0].actor_id == ""


def test_auditable_rejects_sync_function() -> None:
    with pytest.raises(TypeError):

        @auditable(action="READ", resource_type="x", resource_id="id")
        def sync_fn(id: str) -> None:  # pragma: no cover - decoration raises
            return None


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
