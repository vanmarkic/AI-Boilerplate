from datetime import datetime
from fastapi import APIRouter, Depends, status, Query

from core.dependencies import get_incident_service
from features.incidents.incidents_schema import (
    CreateIncidentRequest,
    UpdateIncidentRequest,
    IncidentResponse,
)
from features.incidents.incidents_service import IncidentService

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=IncidentResponse)
async def create_incident(
    request: CreateIncidentRequest,
    service: IncidentService = Depends(get_incident_service),
) -> IncidentResponse:
    return await service.create(request)


@router.get("", response_model=list[IncidentResponse])
async def list_incidents(
    severity: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    service: IncidentService = Depends(get_incident_service),
) -> list[IncidentResponse]:
    return await service.list_by_filters(
        severity=severity,
        status=status_filter,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/timeline/histogram", response_model=list[dict])
async def get_histogram(
    period: str = Query("day"),
    severity: str | None = Query(None),
    service: IncidentService = Depends(get_incident_service),
) -> list[dict]:
    return await service.get_histogram_data(period=period, severity=severity)


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(
    incident_id: int,
    service: IncidentService = Depends(get_incident_service),
) -> IncidentResponse:
    return await service.get_by_id(incident_id)


@router.patch("/{incident_id}", response_model=IncidentResponse)
async def update_incident(
    incident_id: int,
    request: UpdateIncidentRequest,
    service: IncidentService = Depends(get_incident_service),
) -> IncidentResponse:
    return await service.update(incident_id, request)
