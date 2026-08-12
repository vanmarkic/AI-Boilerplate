"""Request and response bodies for event ingestion."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from core.base_schema import ResponseBase
from core.presentation_schema import AlertResponse, ObservableResponse
from domain.verdict_entity import TriageVerdict


class IngestEventRequest(BaseModel):
    """One raw event offered for triage."""

    source: str = Field(min_length=1, max_length=64)
    payload: dict[str, Any]
    external_id: str | None = Field(default=None, max_length=256)


class VerdictResponse(ResponseBase):
    """What triage decided about an event, and why."""

    event_id: UUID
    score: int
    severity: str
    disposition: str
    reasons: list[str]
    labels: list[str]
    matched: list[ObservableResponse]
    decided_at: datetime

    @classmethod
    def of(cls, verdict: TriageVerdict) -> "VerdictResponse":
        """Project a domain verdict onto the wire."""
        return cls(
            event_id=verdict.event_id,
            score=verdict.score,
            severity=verdict.severity.value,
            disposition=verdict.disposition.value,
            reasons=list(verdict.reasons),
            labels=list(verdict.labels),
            matched=[ObservableResponse(type=o.type.value, value=o.value) for o in verdict.matched],
            decided_at=verdict.decided_at,
        )


class TriageResponse(ResponseBase):
    """The full result of ingesting one event."""

    verdict: VerdictResponse
    alert: AlertResponse | None
    deduplicated: bool
    enrichment_degraded: bool
