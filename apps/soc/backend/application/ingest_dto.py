"""Commands and results crossing the application boundary."""

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from domain.event_entity import NormalizedEvent
from domain.verdict_entity import Alert, TriageVerdict


@dataclass(frozen=True, slots=True)
class IngestEventCommand:
    """One raw event offered to the platform."""

    source: str
    payload: Mapping[str, Any]
    external_id: str | None = None


@dataclass(frozen=True, slots=True)
class TriageOutcome:
    """What triage decided, and what it recorded.

    ``alert`` is None when the disposition was DROP: a dropped finding is
    still normalized and indexed, but never becomes actionable work.
    """

    event: NormalizedEvent
    verdict: TriageVerdict
    alert: Alert | None = None
    deduplicated: bool = False
    enrichment_degraded: bool = False
    sighted: tuple[str, ...] = field(default_factory=tuple)
