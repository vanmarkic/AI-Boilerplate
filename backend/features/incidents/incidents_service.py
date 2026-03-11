from datetime import datetime
from fastapi import HTTPException, status

from features.incidents.incidents_model import Incident
from features.incidents.incidents_repository import IncidentRepository
from features.incidents.incidents_schema import (
    CreateIncidentRequest,
    UpdateIncidentRequest,
    IncidentResponse,
)


class IncidentService:
    def __init__(self, repository: IncidentRepository) -> None:
        self.repository = repository

    async def create(self, request: CreateIncidentRequest) -> IncidentResponse:
        incident = Incident(
            title=request.title,
            description=request.description,
            severity=request.severity,
            status="ongoing",
            started_at=request.started_at,
        )
        created = await self.repository.create(incident)
        return IncidentResponse.model_validate(created)

    async def get_by_id(self, incident_id: int) -> IncidentResponse:
        entity = await self.repository.get_by_id(incident_id)
        if not entity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Incident not found",
            )
        return IncidentResponse.model_validate(entity)

    async def list_by_filters(
        self,
        severity: str | None = None,
        status: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> list[IncidentResponse]:
        entities = await self.repository.list_by_filters(
            severity=severity,
            status=status,
            date_from=date_from,
            date_to=date_to,
        )
        return [IncidentResponse.model_validate(e) for e in entities]

    async def update(
        self,
        incident_id: int,
        request: UpdateIncidentRequest,
    ) -> IncidentResponse:
        entity = await self.repository.get_by_id(incident_id)
        if not entity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Incident not found",
            )

        update_data = request.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(entity, field, value)

        updated = await self.repository.update(entity)
        return IncidentResponse.model_validate(updated)

    async def get_histogram_data(
        self,
        period: str = "day",
        severity: str | None = None,
    ) -> list[dict]:
        return await self.repository.get_histogram_data(period=period, severity=severity)
