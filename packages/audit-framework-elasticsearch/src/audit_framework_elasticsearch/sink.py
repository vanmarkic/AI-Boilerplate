"""ElasticsearchSink — index audit events into Elasticsearch *or* OpenSearch.

Elasticsearch and OpenSearch expose the same document-indexing (``/<index>/_doc``)
and cluster-health (``/_cluster/health``) REST API, so a single adapter serves
both; pick the provider/``sink_name`` per deployment.

The sink has **no hard HTTP dependency**: it talks to the cluster through an
injected async ``transport`` callable, so it is fully unit-testable without a
network, and production code can hand it a pooled client. A convenience
:func:`httpx_transport` is provided for the common case (install the ``httpx``
extra: ``pip install audit-framework-elasticsearch[httpx]``).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Optional

from audit_framework.core.models import AuditEvent, PipelineContext

__all__ = [
    "ElasticsearchSink",
    "ElasticsearchSinkError",
    "HttpResult",
    "Transport",
    "httpx_transport",
]


class ElasticsearchSinkError(RuntimeError):
    """Raised when the cluster rejects an index request (non-2xx response)."""


@dataclass
class HttpResult:
    """Minimal transport result: an HTTP status and the parsed JSON body."""

    status: int
    data: Any = None


# async (method, url, json_body, headers) -> HttpResult
Transport = Callable[[str, str, Optional[dict], dict], Awaitable[HttpResult]]


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _json_safe(doc: dict) -> dict:
    """Coerce a document to JSON-native types (e.g. datetime/UUID/Decimal → str).

    The event ``changes``/``metadata`` bags are free-form (``dict[str, Any]``),
    so application code can deposit non-JSON-native values. Round-tripping with
    ``default=str`` mirrors the JSONL sink and guarantees any transport receives
    serialisable data, rather than letting httpx raise a bare ``TypeError``.
    """
    return json.loads(json.dumps(doc, default=str))


class ElasticsearchSink:
    """Indexes each audit event as a document in Elasticsearch/OpenSearch.

    Parameters
    ----------
    base_url:
        Cluster base URL, e.g. ``https://es.internal:9200``.
    index:
        Index name (or prefix when ``daily`` is set).
    name:
        The :pyattr:`sink_name` used for per-policy sink filtering.
    daily:
        When True, write to a date-stamped index ``<index>-YYYY.MM.DD`` (the
        usual time-series pattern, friendly to ILM/ISM retention).
    transport:
        Async ``(method, url, json_body, headers) -> HttpResult`` callable.
        Defaults to an :func:`httpx_transport`.
    api_key:
        Optional API key sent as ``Authorization: ApiKey <key>``.
    headers:
        Extra headers merged into every request.
    clock:
        Injectable time source for the daily index suffix (testing).
    """

    def __init__(
        self,
        base_url: str,
        index: str = "audit",
        *,
        name: str = "elasticsearch",
        daily: bool = True,
        transport: Optional[Transport] = None,
        api_key: Optional[str] = None,
        headers: Optional[dict] = None,
        clock: Callable[[], datetime] = _utc_now,
    ) -> None:
        self._base = base_url.rstrip("/")
        self._index = index
        self._name = name
        self._daily = daily
        self._clock = clock
        self._headers = {"content-type": "application/json"}
        if api_key:
            self._headers["authorization"] = f"ApiKey {api_key}"
        if headers:
            self._headers.update(headers)
        self._transport = transport or httpx_transport()

    @property
    def sink_name(self) -> str:
        """Stable identifier matched against ``AuditPolicy.sinks``."""
        return self._name

    async def emit(self, event: AuditEvent, context: PipelineContext) -> None:
        """Index ``event`` into the (possibly date-stamped) target index.

        Raises :class:`ElasticsearchSinkError` on a non-2xx response so the
        ``SinkFanOutMiddleware`` records the failure without aborting siblings.
        """
        index = self._index_for()
        result = await self._transport(
            "POST", f"{self._base}/{index}/_doc", _json_safe(event.to_dict()), dict(self._headers)
        )
        if result.status >= 300:
            raise ElasticsearchSinkError(
                f"index into {index!r} failed: HTTP {result.status}: {result.data!r}"
            )

    async def health_check(self) -> bool:
        """Return True when the cluster is reachable and not red.

        A reachable cluster (HTTP 200) whose body can't be parsed is treated as
        usable — only an explicit ``red`` status (or an unreachable/non-200
        response) reports unhealthy — so a transient body-parse glitch doesn't
        flap readiness checks.
        """
        try:
            result = await self._transport(
                "GET", f"{self._base}/_cluster/health", None, dict(self._headers)
            )
        except Exception:
            return False
        if result.status != 200:
            return False
        status = result.data.get("status") if isinstance(result.data, dict) else None
        return status != "red"

    def _index_for(self) -> str:
        if not self._daily:
            return self._index
        return f"{self._index}-{self._clock().strftime('%Y.%m.%d')}"


def httpx_transport(
    client: Any = None, *, timeout: float = 10.0
) -> Transport:
    """Build a :data:`Transport` backed by ``httpx`` (the ``httpx`` extra).

    Pass a shared ``httpx.AsyncClient`` for connection pooling in production; if
    omitted, a client is created per request (fine for low volume and tests).
    ``httpx`` is imported lazily, so importing/constructing the sink never
    requires it — only actually emitting through the default transport does.
    """

    async def _send(
        method: str, url: str, json_body: Optional[dict], headers: dict
    ) -> HttpResult:
        async def _do(c: Any) -> HttpResult:
            resp = await c.request(method, url, json=json_body, headers=headers)
            try:
                data = resp.json()
            except Exception:
                data = None
            return HttpResult(resp.status_code, data)

        if client is not None:
            return await _do(client)
        import httpx  # lazy: only needed to create an owned client

        async with httpx.AsyncClient(timeout=timeout) as owned:
            return await _do(owned)

    return _send
