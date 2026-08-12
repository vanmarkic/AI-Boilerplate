"""Listing alerts and acting on them."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from application.escalate_alert_usecase import EscalateAlertUseCase
from application.respond_to_alert_usecase import RespondToAlertUseCase
from core import registry
from core.dependencies import get_escalate_alert_usecase, get_respond_to_alert_usecase
from core.presentation_schema import AlertResponse
from domain.soc_error import UnknownEntityError
from features.alerts.alerts_schema import AlertListResponse, PlaybookRunResponse
from features.cases.cases_schema import CaseResponse

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get(
    "",
    response_model=AlertListResponse,
    status_code=status.HTTP_200_OK,
    operation_id="listAlerts",
)
async def list_alerts(
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AlertListResponse:
    """Return a page of alerts, newest first."""
    alerts = await registry.alert_repository().list_recent(limit=limit, offset=offset)
    return AlertListResponse(items=[AlertResponse.of(a) for a in alerts])


@router.get(
    "/{alert_id}",
    response_model=AlertResponse,
    status_code=status.HTTP_200_OK,
    operation_id="getAlert",
)
async def get_alert(alert_id: UUID) -> AlertResponse:
    """Return one alert."""
    alert = await registry.alert_repository().get(alert_id)
    if alert is None:
        raise UnknownEntityError(f"unknown alert {alert_id}")
    return AlertResponse.of(alert)


@router.post(
    "/{alert_id}/escalate",
    response_model=CaseResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="escalateAlert",
)
async def escalate_alert(
    alert_id: UUID,
    usecase: Annotated[EscalateAlertUseCase, Depends(get_escalate_alert_usecase)],
    actor: Annotated[str, Query(max_length=128)] = "api",
) -> CaseResponse:
    """Correlate an alert onto a case, opening one if none is open."""
    return CaseResponse.of(await usecase.execute(alert_id, actor=actor))


@router.post(
    "/{alert_id}/respond",
    response_model=PlaybookRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="respondToAlert",
)
async def respond_to_alert(
    alert_id: UUID,
    usecase: Annotated[RespondToAlertUseCase, Depends(get_respond_to_alert_usecase)],
) -> PlaybookRunResponse:
    """Select and launch the response playbook for an alert, at most once."""
    return PlaybookRunResponse.of(await usecase.execute(alert_id))
