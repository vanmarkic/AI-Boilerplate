"""Search vocabulary for the document/analytics sink.

Phrased entirely in domain terms: no query DSL, no index names, no cursors
with meaning.  ``EventQuery.cursor`` is opaque and adapter-defined — the core
passes it back untouched, which is what keeps paging portable across engines.
"""

from dataclasses import dataclass, field
from datetime import datetime

from domain.event_entity import NormalizedEvent
from domain.observable_entity import Observable


@dataclass(frozen=True, slots=True)
class EventQuery:
    """A search request over indexed events."""

    text: str | None = None
    observables: tuple[Observable, ...] = field(default_factory=tuple)
    hosts: tuple[str, ...] = field(default_factory=tuple)
    since: datetime | None = None
    until: datetime | None = None
    limit: int = 50
    cursor: str | None = None


@dataclass(frozen=True, slots=True)
class EventPage:
    """One page of search results."""

    items: tuple[NormalizedEvent, ...]
    total: int
    next_cursor: str | None = None


@dataclass(frozen=True, slots=True)
class IndexOutcome:
    """Result of a bulk index operation.

    Indexing is best-effort: the search sink is not the system of record, so
    partial failure is reported rather than raised.
    """

    indexed: int
    failed: int
    failures: tuple[str, ...] = field(default_factory=tuple)
