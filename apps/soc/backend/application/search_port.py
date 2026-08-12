"""Outbound port for the document search / analytics sink.

Deliberately *not* the system of record. Indexing reports partial failure
rather than raising, so a search-engine outage degrades dashboards without
stopping ingestion or losing business state.
"""

from collections.abc import Sequence
from datetime import datetime
from typing import Protocol, runtime_checkable

from domain.event_entity import NormalizedEvent
from domain.indicator_entity import Indicator
from domain.search_entity import EventPage, EventQuery, IndexOutcome


@runtime_checkable
class DocumentSearchPort(Protocol):
    """What the core needs from any search/analytics engine."""

    async def index_events(self, events: Sequence[NormalizedEvent]) -> IndexOutcome:
        """Index events for search. Idempotent on ``event_id``.

        Returns counts rather than raising on partial failure: losing a
        document from a dashboard is not a reason to fail ingestion.
        """
        ...

    async def index_indicators(self, indicators: Sequence[Indicator]) -> IndexOutcome:
        """Index indicators for search. Idempotent on ``indicator_id``."""
        ...

    async def search_events(self, query: EventQuery) -> EventPage:
        """Return one page of matching events.

        ``EventPage.next_cursor`` is opaque and adapter-defined; the core
        passes it back untouched, which keeps paging portable across engines.
        """
        ...

    async def count_observable_hits(self, value: str, since: datetime) -> int:
        """Count indexed events mentioning an observable value since an instant."""
        ...
