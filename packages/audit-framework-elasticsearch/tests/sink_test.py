"""Tests for ElasticsearchSink — stdlib-only, fake transport (no httpx/network)."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import pytest

from audit_framework.core.models import AuditEvent, PipelineContext
from audit_framework.core.ports import ExternalSink
from audit_framework.core.plugin_registry import PluginRegistry

from audit_framework_elasticsearch.plugin import register
from audit_framework_elasticsearch.sink import (
    ElasticsearchSink,
    ElasticsearchSinkError,
    HttpResult,
    httpx_transport,
)


def _event(resource_id: str = "c-1") -> AuditEvent:
    return AuditEvent(
        actor_id="alice",
        action="DELETE",
        resource_type="contract",
        resource_id=resource_id,
        timestamp="2026-06-26T00:00:00+00:00",
        request_id="req-1",
    )


def _ctx(event: AuditEvent) -> PipelineContext:
    return PipelineContext(event=event)


_FIXED_CLOCK = lambda: datetime(2026, 6, 26, 12, 0, tzinfo=timezone.utc)


class FakeTransport:
    """Records requests and returns a canned (or per-call) HttpResult."""

    def __init__(self, result: HttpResult | None = None, raises: Exception | None = None) -> None:
        self.calls: list[tuple] = []
        self._result = result or HttpResult(201, {"result": "created"})
        self._raises = raises

    async def __call__(self, method, url, body, headers):  # type: ignore[no-untyped-def]
        self.calls.append((method, url, body, headers))
        if self._raises is not None:
            raise self._raises
        return self._result


def test_satisfies_external_sink_protocol() -> None:
    sink = ElasticsearchSink("http://es:9200", transport=FakeTransport())
    assert isinstance(sink, ExternalSink)
    assert sink.sink_name == "elasticsearch"


def test_emit_indexes_into_daily_index_with_event_doc() -> None:
    transport = FakeTransport(HttpResult(201, {"result": "created"}))
    sink = ElasticsearchSink("http://es:9200/", transport=transport, clock=_FIXED_CLOCK)
    ev = _event("c-9")

    asyncio.run(sink.emit(ev, _ctx(ev)))

    assert len(transport.calls) == 1
    method, url, body, headers = transport.calls[0]
    assert method == "POST"
    assert url == "http://es:9200/audit-2026.06.26/_doc"  # trailing slash stripped, daily suffix
    assert body == ev.to_dict()
    assert headers["content-type"] == "application/json"


def test_emit_static_index_when_daily_disabled() -> None:
    transport = FakeTransport()
    sink = ElasticsearchSink("http://es:9200", index="auditlog", daily=False, transport=transport)
    ev = _event()

    asyncio.run(sink.emit(ev, _ctx(ev)))

    assert transport.calls[0][1] == "http://es:9200/auditlog/_doc"


def test_emit_raises_on_non_2xx() -> None:
    transport = FakeTransport(HttpResult(503, {"error": "unavailable"}))
    sink = ElasticsearchSink("http://es:9200", transport=transport)
    ev = _event()

    with pytest.raises(ElasticsearchSinkError) as exc:
        asyncio.run(sink.emit(ev, _ctx(ev)))
    assert "503" in str(exc.value)


def test_api_key_sets_authorization_header() -> None:
    transport = FakeTransport()
    sink = ElasticsearchSink("http://es:9200", transport=transport, api_key="secret-key")
    ev = _event()

    asyncio.run(sink.emit(ev, _ctx(ev)))

    assert transport.calls[0][3]["authorization"] == "ApiKey secret-key"


@pytest.mark.parametrize(
    "result,expected",
    [
        (HttpResult(200, {"status": "green"}), True),
        (HttpResult(200, {"status": "yellow"}), True),
        (HttpResult(200, {"status": "red"}), False),
        (HttpResult(503, None), False),
        (HttpResult(200, None), True),  # reachable but unparseable body → usable, not red
    ],
)
def test_health_check(result, expected) -> None:
    sink = ElasticsearchSink("http://es:9200", transport=FakeTransport(result))
    assert asyncio.run(sink.health_check()) is expected


def test_health_check_false_when_transport_raises() -> None:
    sink = ElasticsearchSink("http://es:9200", transport=FakeTransport(raises=ConnectionError("down")))
    assert asyncio.run(sink.health_check()) is False


def test_register_wires_both_providers() -> None:
    registry = PluginRegistry()
    register(registry)
    assert registry.get("external_sink", "elasticsearch") is ElasticsearchSink
    assert registry.get("external_sink", "opensearch") is ElasticsearchSink


def test_end_to_end_through_the_pipeline() -> None:
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

    transport = FakeTransport()
    sink = ElasticsearchSink("http://es:9200", transport=transport, clock=_FIXED_CLOCK)
    pipeline = (
        Pipeline()
        .use(AuditPolicyMiddleware(_PolicyStore()))
        .use(SinkFanOutMiddleware([sink]))
    )

    ctx = asyncio.run(pipeline.execute(_event("c-42")))

    assert "sink_failures" not in ctx.metadata
    assert len(transport.calls) == 1
    assert transport.calls[0][2]["resource_id"] == "c-42"  # event doc was indexed


def test_emit_coerces_non_json_native_values() -> None:
    # A datetime in the free-form metadata bag must not crash the transport;
    # it is stringified (like the JSONL sink's default=str), not passed raw.
    transport = FakeTransport()
    sink = ElasticsearchSink("http://es:9200", transport=transport)
    ev = AuditEvent(
        actor_id="a",
        action="LOGIN",
        resource_type="session",
        resource_id="s-1",
        timestamp="2026-06-26T00:00:00+00:00",
        request_id="r",
        metadata={"at": datetime(2026, 6, 26, tzinfo=timezone.utc)},
    )

    asyncio.run(sink.emit(ev, _ctx(ev)))

    body = transport.calls[0][2]
    assert isinstance(body["metadata"]["at"], str)  # coerced, not a datetime
    assert "2026-06-26" in body["metadata"]["at"]


class _FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class _FakeHttpxClient:
    """Duck-typed stand-in for httpx.AsyncClient (no httpx needed)."""

    def __init__(self, response):
        self.requests: list[dict] = []
        self._response = response

    async def request(self, method, url, *, json=None, headers=None):
        self.requests.append({"method": method, "url": url, "json": json, "headers": headers})
        return self._response


def test_httpx_transport_with_injected_client_is_exercised() -> None:
    # Covers the production default transport's request/parse path without
    # requiring httpx installed (a passed client skips the lazy import).
    client = _FakeHttpxClient(_FakeResponse(201, {"result": "created"}))
    transport = httpx_transport(client)

    result = asyncio.run(transport("POST", "http://es:9200/audit/_doc", {"a": 1}, {"h": "v"}))

    assert isinstance(result, HttpResult)
    assert result.status == 201
    assert result.data == {"result": "created"}
    assert client.requests[0]["method"] == "POST"
    assert client.requests[0]["json"] == {"a": 1}


def test_httpx_transport_handles_unparseable_body() -> None:
    class _Boom(_FakeResponse):
        def json(self):
            raise ValueError("not json")

    client = _FakeHttpxClient(_Boom(200, None))
    transport = httpx_transport(client)
    result = asyncio.run(transport("GET", "http://es:9200/_cluster/health", None, {}))
    assert result.status == 200
    assert result.data is None


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
