from fastapi import HTTPException, status

from features.events.event_model import Event
from features.events.event_repository import EventRepository
from features.events.event_schema import CreateEventRequest, EventResponse, ListEventsResponse


class EventService:
    def __init__(self, repository: EventRepository) -> None:
        self.repository = repository

    async def create_event(self, request: CreateEventRequest) -> EventResponse:
        event = Event(
            title=request.title,
            description=request.description,
            event_time=request.event_time,
            status=request.status,
            event_type=request.event_type,
            badge_variant=request.badge_variant,
        )
        created = await self.repository.create(event)
        return EventResponse.model_validate(created)

    async def get_event(self, event_id: int) -> EventResponse:
        event = await self.repository.get_by_id(event_id)
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found",
            )
        return EventResponse.model_validate(event)

    async def list_events(self) -> ListEventsResponse:
        events = await self.repository.list()
        return ListEventsResponse(
            items=[EventResponse.model_validate(e) for e in events],
            total=len(events),
        )

    async def delete_event(self, event_id: int) -> None:
        event = await self.repository.get_by_id(event_id)
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found",
            )
        await self.repository.delete(event_id)
