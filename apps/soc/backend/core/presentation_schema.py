"""Response shapes shared by more than one inbound slice.

An alert is produced by triage and acted on by the alerts slice, so its wire
projection belongs to neither. Keeping it here avoids a cross-feature schema
import, which would couple the slices and break tier-filtered builds.
"""

from datetime import datetime
from uuid import UUID

from core.base_schema import ResponseBase
from domain.verdict_entity import Alert


class ObservableResponse(ResponseBase):
    """An artefact extracted from an event."""

    type: str
    value: str


class AlertResponse(ResponseBase):
    """A persisted, actionable finding."""

    alert_id: UUID
    event_id: UUID
    title: str
    severity: str
    disposition: str
    score: int
    reasons: list[str]
    labels: list[str]
    observables: list[ObservableResponse]
    source: str
    host: str | None
    asset_criticality: str
    correlation_key: str
    occurred_at: datetime
    created_at: datetime
    case_id: UUID | None

    @classmethod
    def of(cls, alert: Alert) -> "AlertResponse":
        """Project a domain alert onto the wire."""
        return cls(
            alert_id=alert.alert_id,
            event_id=alert.event_id,
            title=alert.title,
            severity=alert.severity.value,
            disposition=alert.disposition.value,
            score=alert.score,
            reasons=list(alert.reasons),
            labels=list(alert.labels),
            observables=[
                ObservableResponse(type=o.type.value, value=o.value) for o in alert.observables
            ],
            source=alert.source,
            host=alert.host,
            asset_criticality=alert.asset_criticality.value,
            correlation_key=alert.correlation_key,
            occurred_at=alert.occurred_at,
            created_at=alert.created_at,
            case_id=alert.case_id,
        )
