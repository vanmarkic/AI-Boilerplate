"""Response bodies for cases."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from core.base_schema import ResponseBase
from domain.case_entity import Case


class CaseRefResponse(ResponseBase):
    """A handle to a case in the external case system."""

    system: str
    external_id: str
    url: str | None


class CaseResponse(ResponseBase):
    """An investigation owned by this platform."""

    case_id: UUID
    correlation_key: str
    title: str
    status: str
    severity: str
    alert_ids: list[UUID]
    opened_at: datetime
    updated_at: datetime
    closed_at: datetime | None
    external_ref: CaseRefResponse | None

    @classmethod
    def of(cls, case: Case) -> "CaseResponse":
        """Project a domain case onto the wire."""
        return cls(
            case_id=case.case_id,
            correlation_key=case.correlation_key,
            title=case.title,
            status=case.status.value,
            severity=case.severity.value,
            alert_ids=list(case.alert_ids),
            opened_at=case.opened_at,
            updated_at=case.updated_at,
            closed_at=case.closed_at,
            external_ref=(
                CaseRefResponse(
                    system=case.external_ref.system,
                    external_id=case.external_ref.external_id,
                    url=case.external_ref.url,
                )
                if case.external_ref
                else None
            ),
        )


class CaseListResponse(ResponseBase):
    """A page of open cases."""

    items: list[CaseResponse]


class TransitionCaseRequest(BaseModel):
    """A requested case state change."""

    status: str
