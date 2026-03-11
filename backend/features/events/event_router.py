from fastapi import APIRouter, Depends, status

from core.dependencies import get_event_service
from features.events.event_schema import CreateEventRequest, EventResponse, ListEventsResponse
from features.events.event_service import EventService

router = APIRouter(prefix="/api/events", tags=["events"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=EventResponse, operation_id="createEvent")
async def create_event(
    request: CreateEventRequest,
    service: EventService = Depends(get_event_service),
) -> EventResponse:
    return await service.create_event(request)


@router.get("", response_model=ListEventsResponse, operation_id="listEvents")
async def list_events(
    service: EventService = Depends(get_event_service),
) -> ListEventsResponse:
    return await service.list_events()


@router.get("/{event_id}", response_model=EventResponse, operation_id="getEvent")
async def get_event(
    event_id: int,
    service: EventService = Depends(get_event_service),
) -> EventResponse:
    return await service.get_event(event_id)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT, operation_id="deleteEvent")
async def delete_event(
    event_id: int,
    service: EventService = Depends(get_event_service),
) -> None:
    await service.delete_event(event_id)
