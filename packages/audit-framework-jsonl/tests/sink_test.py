"""Tests for JsonlFileSink — stdlib-only, no infrastructure (uses tmp_path)."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

import pytest

from audit_framework.core.models import AuditEvent, PipelineContext
from audit_framework.core.ports import ExternalSink
from audit_framework.core.plugin_registry import PluginRegistry

from audit_framework_jsonl.plugin import register
from audit_framework_jsonl.sink import JsonlFileSink


def _event(resource_id: str = "c-1", action: str = "DELETE") -> AuditEvent:
    return AuditEvent(
        actor_id="alice",
        action=action,
        resource_type="contract",
        resource_id=resource_id,
        timestamp="2026-06-26T00:00:00+00:00",
        request_id="req-1",
        changes={"amount": {"old": 1, "new": 2}},
    )


def _ctx(event: AuditEvent) -> PipelineContext:
    return PipelineContext(event=event)


def test_satisfies_external_sink_protocol(tmp_path) -> None:
    sink = JsonlFileSink(tmp_path / "audit.jsonl")
    assert isinstance(sink, ExternalSink)  # structural (runtime_checkable) check
    assert sink.sink_name == "file_jsonl"


def test_emit_appends_one_json_line_per_event(tmp_path) -> None:
    path = tmp_path / "audit.jsonl"
    sink = JsonlFileSink(path)

    asyncio.run(sink.emit(_event("c-1"), _ctx(_event("c-1"))))
    asyncio.run(sink.emit(_event("c-2"), _ctx(_event("c-2"))))

    lines = path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 2
    first = json.loads(lines[0])
    assert first["action"] == "DELETE"
    assert first["resource_id"] == "c-1"
    assert first["changes"] == {"amount": {"old": 1, "new": 2}}
    assert json.loads(lines[1])["resource_id"] == "c-2"


def test_creates_parent_directories(tmp_path) -> None:
    path = tmp_path / "nested" / "dir" / "audit.jsonl"
    sink = JsonlFileSink(path)
    ev = _event()
    asyncio.run(sink.emit(ev, _ctx(ev)))
    assert path.exists()


def test_daily_rotation_uses_date_stamped_file(tmp_path) -> None:
    clock = lambda: datetime(2026, 6, 26, 12, 0, tzinfo=timezone.utc)
    sink = JsonlFileSink(tmp_path / "audit.jsonl", daily=True, clock=clock)
    ev = _event()

    asyncio.run(sink.emit(ev, _ctx(ev)))

    assert (tmp_path / "audit-2026-06-26.jsonl").exists()
    assert not (tmp_path / "audit.jsonl").exists()


def test_size_rollover_moves_current_file_aside(tmp_path) -> None:
    path = tmp_path / "audit.jsonl"
    # tiny threshold so the second write triggers a rollover of the first
    sink = JsonlFileSink(path, max_bytes=10)
    ev = _event()

    asyncio.run(sink.emit(ev, _ctx(ev)))  # creates the file
    asyncio.run(sink.emit(ev, _ctx(ev)))  # rolls the full file aside, writes fresh

    rolled = list(tmp_path.glob("audit.*.jsonl"))
    assert len(rolled) == 1  # exactly one rolled-aside file
    assert len(rolled[0].read_text(encoding="utf-8").splitlines()) == 1
    assert len(path.read_text(encoding="utf-8").splitlines()) == 1  # fresh current file


def test_health_check_true_for_writable_dir(tmp_path) -> None:
    sink = JsonlFileSink(tmp_path / "sub" / "audit.jsonl")
    assert asyncio.run(sink.health_check()) is True


def test_concurrent_emits_do_not_interleave(tmp_path) -> None:
    path = tmp_path / "audit.jsonl"
    sink = JsonlFileSink(path)

    async def emit_many() -> None:
        events = [_event(f"c-{i}") for i in range(25)]
        await asyncio.gather(*(sink.emit(e, _ctx(e)) for e in events))

    asyncio.run(emit_many())

    lines = path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 25
    # every line is intact JSON (no corruption) and all events are present
    ids = sorted(json.loads(line)["resource_id"] for line in lines)
    assert ids == sorted(f"c-{i}" for i in range(25))


def test_register_wires_sink_into_registry() -> None:
    registry = PluginRegistry()
    register(registry)
    assert registry.get("external_sink", "file_jsonl") is JsonlFileSink
    assert "file_jsonl" in registry.list_providers("external_sink")


def test_end_to_end_through_the_pipeline(tmp_path) -> None:
    # Prove the reference sink composes with the real core: an event audited by
    # the pipeline is fanned out to the JSONL file by SinkFanOutMiddleware.
    from audit_framework.core.middlewares.audit_policy import AuditPolicyMiddleware
    from audit_framework.core.middlewares.sink_fanout import SinkFanOutMiddleware
    from audit_framework.core.models import AuditPolicy
    from audit_framework.core.pipeline import Pipeline

    class _PolicyStore:
        def get_audit_policies(self):
            return [AuditPolicy(name="all", match={})]

        def get_broadcast_policies(self):
            return []

        def reload(self):
            pass

    path = tmp_path / "audit.jsonl"
    sink = JsonlFileSink(path)
    pipeline = (
        Pipeline()
        .use(AuditPolicyMiddleware(_PolicyStore()))
        .use(SinkFanOutMiddleware([sink]))
    )

    ctx = asyncio.run(pipeline.execute(_event("c-9")))

    assert "sink_failures" not in ctx.metadata
    lines = path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    assert json.loads(lines[0])["resource_id"] == "c-9"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
