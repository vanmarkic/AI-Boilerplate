"""The in-memory search sink satisfies the DocumentSearchPort contract."""

import base64

import pytest

from adapters.contract.search_contract import DocumentSearchContract, make_event
from adapters.memory.memory_search_adapter import MemorySearchAdapter
from application.search_port import DocumentSearchPort
from domain.search_entity import EventQuery


class TestMemorySearch(DocumentSearchContract):
    """Runs the shared contract against the in-memory implementation."""

    @pytest.fixture
    def port(self) -> DocumentSearchPort:
        return MemorySearchAdapter()


class TestHostileCursor:
    """A cursor is client-supplied, so it is untrusted input like any other.

    The failure that motivated this is not a crash: a cursor decoding to a
    negative offset yields an empty window, so ``consumed`` stays negative, so
    the adapter re-encodes the same cursor. Any client looping "while
    next_cursor is not None" spins forever on a page that never advances.
    """

    @pytest.fixture
    async def stocked(self) -> MemorySearchAdapter:
        adapter = MemorySearchAdapter()
        await adapter.index_events([make_event(f"host{n:02d}") for n in range(10)])
        return adapter

    @pytest.mark.parametrize(
        "cursor",
        [
            base64.urlsafe_b64encode(b"-5").decode(),
            base64.urlsafe_b64encode(b"-1").decode(),
            base64.urlsafe_b64encode(b"not-a-number").decode(),
            "not-even-base64!!",
            "",
        ],
        ids=["negative", "minus-one", "non-numeric", "not-base64", "empty"],
    )
    async def test_paging_always_terminates(
        self, stocked: MemorySearchAdapter, cursor: str
    ) -> None:
        """Follow the cursor chain; it must reach None rather than repeat."""
        seen: set[str] = set()
        current: str | None = cursor
        for _ in range(20):
            page = await stocked.search_events(EventQuery(limit=3, cursor=current))
            if page.next_cursor is None:
                return
            assert page.next_cursor not in seen, f"cursor {page.next_cursor!r} repeats — loop"
            seen.add(page.next_cursor)
            current = page.next_cursor
        pytest.fail("paging did not terminate within 20 pages over 10 events")

    async def test_an_unusable_cursor_starts_at_the_beginning(
        self, stocked: MemorySearchAdapter
    ) -> None:
        """Negative is unusable, so it means "start", exactly like garbage does."""
        hostile = await stocked.search_events(
            EventQuery(limit=3, cursor=base64.urlsafe_b64encode(b"-5").decode())
        )
        fresh = await stocked.search_events(EventQuery(limit=3))
        assert hostile.items == fresh.items

    async def test_a_cursor_past_the_end_ends_the_walk(self, stocked: MemorySearchAdapter) -> None:
        page = await stocked.search_events(
            EventQuery(limit=3, cursor=base64.urlsafe_b64encode(b"9999").decode())
        )
        assert page.items == ()
        assert page.next_cursor is None
