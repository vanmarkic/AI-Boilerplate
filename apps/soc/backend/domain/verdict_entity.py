"""Triage output: what we decided about an event, and why."""

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from domain.event_entity import AssetCriticality
from domain.indicator_entity import IndicatorIntel
from domain.observable_entity import Observable


class Severity(StrEnum):
    """How bad this looks."""

    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Disposition(StrEnum):
    """What we are going to do about it."""

    DROP = "drop"
    MONITOR = "monitor"
    ALERT = "alert"
    ESCALATE = "escalate"


SEVERITY_RANK: Mapping[Severity, int] = {
    Severity.INFO: 0,
    Severity.LOW: 1,
    Severity.MEDIUM: 2,
    Severity.HIGH: 3,
    Severity.CRITICAL: 4,
}


@dataclass(frozen=True, slots=True)
class EnrichmentResult:
    """What we learned about one observable during triage.

    ``degraded`` records that the intel source was unreachable, so the answer
    is local-only.  Triage continues either way — an intel outage must never
    stop ingestion.
    """

    observable: Observable
    intel: IndicatorIntel | None
    allowlisted: bool
    degraded: bool = False


@dataclass(frozen=True, slots=True)
class TriageVerdict:
    """The scored decision for a single event.

    ``reasons`` records every scoring rule that fired, in order, so an analyst
    can always reconstruct why a score is what it is.
    """

    event_id: UUID
    score: int
    severity: Severity
    disposition: Disposition
    reasons: tuple[str, ...]
    matched: tuple[Observable, ...]
    decided_at: datetime
    labels: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class Alert:
    """A persisted, actionable finding. Created when disposition is not DROP."""

    alert_id: UUID
    event_id: UUID
    dedup_key: str
    title: str
    severity: Severity
    disposition: Disposition
    score: int
    reasons: tuple[str, ...]
    observables: tuple[Observable, ...]
    source: str
    host: str | None
    asset_criticality: AssetCriticality
    occurred_at: datetime
    created_at: datetime
    case_id: UUID | None = None
    labels: tuple[str, ...] = field(default_factory=tuple)
