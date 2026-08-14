"""Cases: the investigation record.

``Case`` is ours.  ``CaseRef`` is the only handle to whatever external case
system is configured — an opaque (system, external_id) pair that the core
never interprets.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from domain.observable_entity import Observable
from domain.verdict_entity import Severity


class CaseStatus(StrEnum):
    """Case lifecycle state."""

    OPEN = "open"
    IN_PROGRESS = "in_progress"
    CONTAINED = "contained"
    CLOSED_RESOLVED = "closed_resolved"
    CLOSED_FALSE_POSITIVE = "closed_false_positive"


TERMINAL_STATUSES: frozenset[CaseStatus] = frozenset(
    {CaseStatus.CLOSED_RESOLVED, CaseStatus.CLOSED_FALSE_POSITIVE}
)


@dataclass(frozen=True, slots=True)
class CaseRef:
    """An opaque handle to a case in an external system."""

    system: str
    external_id: str
    url: str | None = None


@dataclass(frozen=True, slots=True)
class CaseNote:
    """A note to append to a case."""

    title: str
    body: str
    author: str


@dataclass(frozen=True, slots=True)
class CaseDraft:
    """Everything an external system needs to open a case on our behalf."""

    title: str
    summary: str
    severity: Severity
    correlation_key: str
    observables: tuple[Observable, ...] = field(default_factory=tuple)
    tags: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class Case:
    """A case record owned by this platform.

    Persisted locally *before* the external system is called, so an outage in
    the case manager can never lose the investigation.
    """

    case_id: UUID
    correlation_key: str
    title: str
    status: CaseStatus
    severity: Severity
    alert_ids: tuple[UUID, ...]
    opened_at: datetime
    updated_at: datetime
    closed_at: datetime | None = None
    external_ref: CaseRef | None = None


@dataclass(frozen=True, slots=True)
class ExternalCaseSnapshot:
    """What the external system currently believes about a case."""

    ref: CaseRef
    status: CaseStatus
    owner: str | None = None
    updated_at: datetime | None = None
