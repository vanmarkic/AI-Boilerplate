"""Behaviour every DocumentSearchPort implementation must exhibit.

The search sink is explicitly *not* the system of record, so the contract
requires partial failure to be reported rather than raised.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest

from application.search_port import DocumentSearchPort
from domain.event_entity import AssetCriticality, NormalizedEvent
from domain.observable_entity import Observable, ObservableType
from domain.search_entity import EventQuery

NOW = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
IP = Observable(ObservableType.IPV4, "203.0.113.9")


def make_event(
    host: str = "web01",
    event_id: UUID | None = None,
    occurred_at: datetime = NOW,
) -> NormalizedEvent:
    """Build an indexable event."""
    return NormalizedEvent(
        event_id=event_id or uuid4(),
        source="test",
        occurred_at=occurred_at,
        received_at=occurred_at,
        category="malware",
        action="exec",
        message="beacon to evil.com",
        host=host,
        user="alice",
        asset_criticality=AssetCriticality.STANDARD,
        observables=(IP,),
        dedup_key=f"dedup-{host}-{occurred_at.isoformat()}",
    )


class DocumentSearchContract:
    """Subclass this and supply ``port``."""

    @pytest.fixture
    def port(self) -> DocumentSearchPort:
        """The implementation under test."""
        raise NotImplementedError

    async def test_satisfies_the_port(self, port: DocumentSearchPort) -> None:
        assert isinstance(port, DocumentSearchPort)

    async def test_indexing_reports_how_many_documents_landed(
        self, port: DocumentSearchPort
    ) -> None:
        outcome = await port.index_events([make_event(), make_event("web02")])
        assert outcome.indexed == 2
        assert outcome.failed == 0

    async def test_indexing_nothing_is_not_an_error(self, port: DocumentSearchPort) -> None:
        outcome = await port.index_events([])
        assert outcome.indexed == 0
        assert outcome.failed == 0

    async def test_indexed_events_are_searchable(self, port: DocumentSearchPort) -> None:
        event = make_event()
        await port.index_events([event])
        page = await port.search_events(EventQuery())
        assert any(item.event_id == event.event_id for item in page.items)

    async def test_search_filters_by_host(self, port: DocumentSearchPort) -> None:
        await port.index_events([make_event("web01"), make_event("web02")])
        page = await port.search_events(EventQuery(hosts=("web02",)))
        assert {item.host for item in page.items} == {"web02"}

    async def test_search_filters_by_observable(self, port: DocumentSearchPort) -> None:
        await port.index_events([make_event()])
        page = await port.search_events(EventQuery(observables=(IP,)))
        assert page.items

        other = Observable(ObservableType.IPV4, "198.51.100.1")
        empty = await port.search_events(EventQuery(observables=(other,)))
        assert not empty.items

    async def test_search_filters_by_time_window(self, port: DocumentSearchPort) -> None:
        old = make_event(occurred_at=NOW - timedelta(days=30))
        recent = make_event(occurred_at=NOW)
        await port.index_events([old, recent])
        page = await port.search_events(EventQuery(since=NOW - timedelta(days=1)))
        assert {item.event_id for item in page.items} == {recent.event_id}

    async def test_search_respects_the_limit(self, port: DocumentSearchPort) -> None:
        await port.index_events([make_event(f"host{n}") for n in range(5)])
        page = await port.search_events(EventQuery(limit=2))
        assert len(page.items) <= 2

    async def test_search_reports_the_total_beyond_the_page(self, port: DocumentSearchPort) -> None:
        await port.index_events([make_event(f"host{n}") for n in range(5)])
        page = await port.search_events(EventQuery(limit=2))
        assert page.total >= 5

    async def test_empty_index_returns_an_empty_page(self, port: DocumentSearchPort) -> None:
        page = await port.search_events(EventQuery())
        assert page.items == ()
        assert page.next_cursor is None

    async def test_reindexing_the_same_event_does_not_duplicate_it(
        self, port: DocumentSearchPort
    ) -> None:
        """Replays must be idempotent, or dashboards double-count."""
        event = make_event()
        await port.index_events([event])
        await port.index_events([event])
        page = await port.search_events(EventQuery())
        matching = [i for i in page.items if i.event_id == event.event_id]
        assert len(matching) == 1

    async def test_counting_observable_hits(self, port: DocumentSearchPort) -> None:
        await port.index_events([make_event("web01"), make_event("web02")])
        count = await port.count_observable_hits(IP.value, NOW - timedelta(days=1))
        assert count == 2
