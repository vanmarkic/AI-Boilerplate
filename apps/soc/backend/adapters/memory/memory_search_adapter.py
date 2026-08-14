"""In-memory document search.

Production-selectable: with ``SEARCH_PROVIDER=memory`` the platform runs
its full pipeline with no search engine deployed.
"""

import base64
from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from domain.event_entity import NormalizedEvent
from domain.indicator_entity import Indicator
from domain.search_entity import EventPage, EventQuery, IndexOutcome


class MemorySearchAdapter:
    """Stores documents in process and filters them in Python."""

    def __init__(self) -> None:
        self._events: dict[UUID, NormalizedEvent] = {}
        self._indicators: dict[UUID, Indicator] = {}

    async def index_events(self, events: Sequence[NormalizedEvent]) -> IndexOutcome:
        """Upsert events by id, so replays never duplicate."""
        for event in events:
            self._events[event.event_id] = event
        return IndexOutcome(indexed=len(events), failed=0)

    async def index_indicators(self, indicators: Sequence[Indicator]) -> IndexOutcome:
        """Upsert indicators by id."""
        for indicator in indicators:
            self._indicators[indicator.indicator_id] = indicator
        return IndexOutcome(indexed=len(indicators), failed=0)

    def _matches(self, event: NormalizedEvent, query: EventQuery) -> bool:
        """Return True if an event satisfies every filter in the query."""
        if query.hosts and event.host not in query.hosts:
            return False
        if query.observables and not set(query.observables) & set(event.observables):
            return False
        if query.since and event.occurred_at < query.since:
            return False
        if query.until and event.occurred_at > query.until:
            return False
        if query.text and query.text.lower() not in event.message.lower():
            return False
        return True

    async def search_events(self, query: EventQuery) -> EventPage:
        """Filter, sort newest-first, and page with an opaque offset cursor."""
        matched = [e for e in self._events.values() if self._matches(e, query)]
        matched.sort(key=lambda e: (e.occurred_at, str(e.event_id)), reverse=True)

        offset = _decode_cursor(query.cursor)
        window = matched[offset : offset + query.limit]
        consumed = offset + len(window)
        next_cursor = _encode_cursor(consumed) if consumed < len(matched) else None

        return EventPage(items=tuple(window), total=len(matched), next_cursor=next_cursor)

    async def count_observable_hits(self, value: str, since: datetime) -> int:
        """Count indexed events mentioning an observable value since an instant."""
        return sum(
            1
            for event in self._events.values()
            if event.occurred_at >= since and any(o.value == value for o in event.observables)
        )


def _encode_cursor(offset: int) -> str:
    """Encode a paging offset as an opaque token."""
    return base64.urlsafe_b64encode(str(offset).encode()).decode()


def _decode_cursor(cursor: str | None) -> int:
    """Decode an opaque paging token, treating anything unusable as the start.

    A cursor comes from a client, so it is untrusted. Unusable includes negative:
    ``int`` parses "-5" happily, and a negative offset produces an empty window,
    which leaves ``consumed`` negative, which re-encodes the same cursor — a page
    that never advances and a caller that never stops asking.
    """
    if not cursor:
        return 0
    try:
        offset = int(base64.urlsafe_b64decode(cursor.encode()).decode())
    except (ValueError, UnicodeDecodeError):
        return 0
    return max(0, offset)
