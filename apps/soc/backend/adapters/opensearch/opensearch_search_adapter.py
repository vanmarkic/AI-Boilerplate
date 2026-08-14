"""OpenSearch as a DocumentSearchPort.

Bulk indexing reports partial failure rather than raising: the search sink is
an analytics surface, not the system of record, so losing a document from a
dashboard must never undo work already committed to our own store.
"""

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any

from adapters.opensearch.opensearch_client import OpenSearchClient
from adapters.opensearch.opensearch_mapper import (
    document_to_event,
    encode_cursor,
    event_to_document,
    indicator_to_document,
    observable_count_dsl,
    query_to_dsl,
)
from domain.event_entity import NormalizedEvent
from domain.indicator_entity import Indicator
from domain.search_entity import EventPage, EventQuery, IndexOutcome

SUCCESS_CEILING = 300


class OpenSearchSearchAdapter:
    """Indexes and searches documents in an OpenSearch cluster."""

    def __init__(
        self,
        client: OpenSearchClient,
        *,
        event_index: str,
        indicator_index: str,
    ) -> None:
        self._client = client
        self._event_index = event_index
        self._indicator_index = indicator_index

    async def aclose(self) -> None:
        """Release the underlying connection pool."""
        await self._client.aclose()

    @staticmethod
    def _outcome_of(response: Mapping[str, Any], attempted: int) -> IndexOutcome:
        """Read per-document results out of a bulk response."""
        items = response.get("items")
        if not isinstance(items, list):
            return IndexOutcome(indexed=attempted, failed=0)

        indexed = 0
        failures: list[str] = []
        for item in items:
            result = item.get("index", {}) if isinstance(item, Mapping) else {}
            status = result.get("status", 0)
            if isinstance(status, int) and status < SUCCESS_CEILING:
                indexed += 1
                continue
            error = result.get("error", {})
            reason = error.get("reason") if isinstance(error, Mapping) else str(error)
            failures.append(f"{result.get('_id', '?')}: {reason or status}")

        return IndexOutcome(indexed=indexed, failed=len(failures), failures=tuple(failures))

    async def index_events(self, events: Sequence[NormalizedEvent]) -> IndexOutcome:
        """Index events, keyed by event id so replays overwrite rather than duplicate."""
        if not events:
            return IndexOutcome(indexed=0, failed=0)
        documents = [(str(e.event_id), event_to_document(e)) for e in events]
        response = await self._client.bulk_index(self._event_index, documents)
        return self._outcome_of(response, len(events))

    async def index_indicators(self, indicators: Sequence[Indicator]) -> IndexOutcome:
        """Index indicators, keyed by indicator id."""
        if not indicators:
            return IndexOutcome(indexed=0, failed=0)
        documents = [(str(i.indicator_id), indicator_to_document(i)) for i in indicators]
        response = await self._client.bulk_index(self._indicator_index, documents)
        return self._outcome_of(response, len(indicators))

    async def search_events(self, query: EventQuery) -> EventPage:
        """Return one page of matching events, paged with search_after."""
        response = await self._client.search(self._event_index, query_to_dsl(query))
        hits_envelope = response.get("hits", {})
        raw_hits = hits_envelope.get("hits", []) if isinstance(hits_envelope, Mapping) else []

        events: list[NormalizedEvent] = []
        last_sort: Sequence[Any] | None = None
        for hit in raw_hits:
            if not isinstance(hit, Mapping):
                continue
            source = hit.get("_source")
            if not isinstance(source, Mapping):
                continue
            event = document_to_event(source)
            if event is not None:
                events.append(event)
                sort_values = hit.get("sort")
                if isinstance(sort_values, list):
                    last_sort = sort_values

        total_envelope = (
            hits_envelope.get("total", {}) if isinstance(hits_envelope, Mapping) else {}
        )
        total = (
            total_envelope.get("value", len(events))
            if isinstance(total_envelope, Mapping)
            else len(events)
        )

        next_cursor = (
            encode_cursor(last_sort)
            if last_sort is not None and len(raw_hits) >= query.limit
            else None
        )
        return EventPage(items=tuple(events), total=int(total), next_cursor=next_cursor)

    async def count_observable_hits(self, value: str, since: datetime) -> int:
        """Count indexed events mentioning an observable value since an instant."""
        return await self._client.count(self._event_index, observable_count_dsl(value, since))
