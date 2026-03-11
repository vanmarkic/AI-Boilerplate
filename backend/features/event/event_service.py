from fastapi import HTTPException, status

from core.auth import CurrentUser
from features.event.event_model import Event
from features.event.event_repository import EventRepository
from features.event.event_schema import CreateEventRequest, EventResponse


class EventService:
    def __init__(self, repository: EventRepository) -> None:
        self.repository = repository

    async def create(self, request: CreateEventRequest, user: CurrentUser) -> EventResponse:
        event = Event(
            timestamp=request.timestamp,
            event_type=request.event_type,
            severity=request.severity,
            description=request.description,
            created_by=user.id,
            metadata=request.metadata,
        )
        created = await self.repository.create(event)
        return EventResponse.model_validate(created)

    async def get_by_id(self, event_id: int) -> EventResponse:
        entity = await self.repository.get_by_id(event_id)
        if not entity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found",
            )
        return EventResponse.model_validate(entity)
