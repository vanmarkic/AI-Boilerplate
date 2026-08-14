"""Response bodies for alerts and their actions."""

from datetime import datetime
from uuid import UUID

from core.base_schema import ResponseBase
from core.presentation_schema import AlertResponse
from domain.playbook_entity import PlaybookRun


class AlertListResponse(ResponseBase):
    """A page of alerts."""

    items: list[AlertResponse]


class PlaybookRunResponse(ResponseBase):
    """The record of an automated response action."""

    run_id: UUID
    playbook_id: str | None
    status: str
    idempotency_key: str
    inputs: dict[str, str]
    output: dict[str, str]
    error: str | None
    alert_id: UUID | None
    case_id: UUID | None
    started_at: datetime
    finished_at: datetime | None

    @classmethod
    def of(cls, run: PlaybookRun) -> "PlaybookRunResponse":
        """Project a domain run onto the wire."""
        return cls(
            run_id=run.run_id,
            playbook_id=run.playbook_id,
            status=run.status.value,
            idempotency_key=run.idempotency_key,
            inputs=dict(run.inputs),
            output=dict(run.output),
            error=run.error,
            alert_id=run.alert_id,
            case_id=run.case_id,
            started_at=run.started_at,
            finished_at=run.finished_at,
        )
