"""The OpenSearch adapter satisfies the DocumentSearchPort contract.

Backed by an in-memory fake OpenSearch served over httpx.MockTransport: it
parses the real ndjson bulk format and the real query DSL, so the adapter is
exercised against the wire shapes it will meet in production without any
engine running.
"""

import json
from typing import Any

import httpx
import pytest

from adapters.contract.search_contract import DocumentSearchContract, make_event
from adapters.opensearch.opensearch_client import OpenSearchClient
from adapters.opensearch.opensearch_search_adapter import OpenSearchSearchAdapter
from adapters.resilient_client import HttpConfig, ResilientHttpClient
from application.search_port import DocumentSearchPort
from domain.search_entity import EventQuery
from domain.soc_error import IntegrationUnavailableError

EVENT_INDEX = "soc-events"
INDICATOR_INDEX = "soc-indicators"


async def _no_sleep(seconds: float) -> None:
    return None


class FakeOpenSearch:
    """Just enough OpenSearch to exercise the adapter's wire format."""

    def __init__(self) -> None:
        self.documents: dict[str, dict[str, Any]] = {}
        self.last_query: dict[str, Any] = {}

    def _bulk(self, body: str) -> httpx.Response:
        """Parse ndjson action/source pairs, as OpenSearch does."""
        lines = [line for line in body.split("\n") if line.strip()]
        items = []
        for action_line, source_line in zip(lines[0::2], lines[1::2], strict=False):
            action = json.loads(action_line)
            source = json.loads(source_line)
            doc_id = action["index"]["_id"]
            self.documents[doc_id] = source
            items.append({"index": {"_id": doc_id, "status": 201}})
        return httpx.Response(200, json={"took": 1, "errors": False, "items": items})

    def _matches(self, source: dict[str, Any], query: dict[str, Any]) -> bool:
        """Evaluate the subset of the DSL the adapter emits."""
        for clause in query.get("bool", {}).get("filter", []):
            if "term" in clause:
                field, value = next(iter(clause["term"].items()))
                held = source.get(field)
                # A term query against an array field matches any element,
                # which is exactly how the adapter counts observable hits.
                held_list = held if isinstance(held, list) else [held]
                if value not in held_list:
                    return False
            elif "terms" in clause:
                field, values = next(iter(clause["terms"].items()))
                held = source.get(field)
                held_list = held if isinstance(held, list) else [held]
                if not set(values) & set(held_list):
                    return False
            elif "range" in clause:
                field, bounds = next(iter(clause["range"].items()))
                held = source.get(field)
                if "gte" in bounds and held < bounds["gte"]:
                    return False
                if "lte" in bounds and held > bounds["lte"]:
                    return False
            elif "match" in clause:
                field, value = next(iter(clause["match"].items()))
                if str(value).lower() not in str(source.get(field, "")).lower():
                    return False
        return True

    def _search(self, body: dict[str, Any]) -> httpx.Response:
        self.last_query = body
        matched = [d for d in self.documents.values() if self._matches(d, body.get("query", {}))]
        matched.sort(key=lambda d: d.get("@timestamp", ""), reverse=True)
        size = body.get("size", 10)
        window = matched[:size]
        hits = [{"_source": doc, "sort": [doc.get("@timestamp")]} for doc in window]
        return httpx.Response(
            200,
            json={"hits": {"total": {"value": len(matched)}, "hits": hits}},
        )

    def handler(self, request: httpx.Request) -> httpx.Response:
        """Route a request to the right canned endpoint."""
        path = request.url.path
        raw = request.read().decode()
        if path == "/_bulk":
            return self._bulk(raw)
        if path.endswith("/_search"):
            return self._search(json.loads(raw or "{}"))
        if path.endswith("/_count"):
            body = json.loads(raw or "{}")
            matched = [
                d for d in self.documents.values() if self._matches(d, body.get("query", {}))
            ]
            return httpx.Response(200, json={"count": len(matched)})
        return httpx.Response(404, json={"error": "no route"})


def build(handler: object) -> OpenSearchSearchAdapter:
    """Build an OpenSearch adapter over a canned transport."""
    http = ResilientHttpClient(
        HttpConfig(system="search", base_url="https://opensearch.invalid"),
        transport=httpx.MockTransport(handler),  # type: ignore[arg-type]
        sleep=_no_sleep,
    )
    return OpenSearchSearchAdapter(
        OpenSearchClient(http),
        event_index=EVENT_INDEX,
        indicator_index=INDICATOR_INDEX,
    )


class TestOpenSearchDocumentSearch(DocumentSearchContract):
    """Runs the shared contract against the OpenSearch implementation."""

    @pytest.fixture
    def port(self) -> DocumentSearchPort:
        return build(FakeOpenSearch().handler)


class TestOpenSearchWireFormat:
    """The vendor-specific details the contract cannot express."""

    async def test_bulk_body_is_ndjson_with_a_trailing_newline(self) -> None:
        """OpenSearch rejects a bulk body whose final line is not terminated."""
        seen: dict[str, str] = {}
        engine = FakeOpenSearch()

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/_bulk":
                seen["body"] = request.read().decode()
                seen["content_type"] = request.headers.get("content-type", "")
            return engine.handler(request)

        await build(handler).index_events([make_event()])

        assert seen["body"].endswith("\n")
        assert seen["content_type"] == "application/x-ndjson"
        lines = [line for line in seen["body"].split("\n") if line]
        assert len(lines) == 2
        assert json.loads(lines[0])["index"]["_index"] == EVENT_INDEX

    async def test_documents_are_keyed_by_event_id(self) -> None:
        """Explicit ids are what make re-indexing idempotent."""
        engine = FakeOpenSearch()
        event = make_event()
        await build(engine.handler).index_events([event])
        assert str(event.event_id) in engine.documents

    async def test_events_are_written_in_ecs_shape(self) -> None:
        engine = FakeOpenSearch()
        event = make_event()
        await build(engine.handler).index_events([event])

        doc = engine.documents[str(event.event_id)]
        assert doc["event.category"] == "malware"
        assert doc["host.name"] == "web01"
        assert doc["soc.dedup_key"] == event.dedup_key
        assert "@timestamp" in doc

    async def test_search_emits_a_bool_filter_query(self) -> None:
        engine = FakeOpenSearch()
        adapter = build(engine.handler)
        await adapter.index_events([make_event()])
        await adapter.search_events(EventQuery(hosts=("web01",), limit=5))

        assert "bool" in engine.last_query["query"]
        assert engine.last_query["size"] == 5
        assert engine.last_query["track_total_hits"] is True

    async def test_indicator_indexing_targets_its_own_index(self) -> None:
        seen: list[str] = []
        engine = FakeOpenSearch()

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/_bulk":
                body = request.read().decode()
                for line in body.split("\n"):
                    if '"index"' in line:
                        seen.append(json.loads(line)["index"]["_index"])
            return engine.handler(request)

        await build(handler).index_indicators([])
        assert seen == []

    async def test_partial_bulk_failure_is_reported_not_raised(self) -> None:
        """The search sink is not the system of record; losing a doc is survivable."""

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={
                    "took": 1,
                    "errors": True,
                    "items": [
                        {"index": {"_id": "a", "status": 201}},
                        {
                            "index": {
                                "_id": "b",
                                "status": 400,
                                "error": {"reason": "mapper_parsing_exception"},
                            }
                        },
                    ],
                },
            )

        outcome = await build(handler).index_events([make_event("h1"), make_event("h2")])

        assert outcome.indexed == 1
        assert outcome.failed == 1
        assert any("mapper_parsing_exception" in f for f in outcome.failures)

    async def test_engine_outage_surfaces_as_unavailable(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(503, json={"error": "unavailable"})

        with pytest.raises(IntegrationUnavailableError):
            await build(handler).search_events(EventQuery())

    async def test_a_full_page_offers_a_cursor(self) -> None:
        engine = FakeOpenSearch()
        adapter = build(engine.handler)
        await adapter.index_events([make_event(f"host{n}") for n in range(3)])

        page = await adapter.search_events(EventQuery(limit=2))
        assert len(page.items) == 2
        assert page.next_cursor is not None
