from fastapi import APIRouter, Depends, status

from core.auth import CurrentUser, get_current_user
from core.dependencies import get_event_service
from features.event.event_schema import CreateEventRequest, EventResponse
from features.event.event_service import EventService

router = APIRouter(prefix="/api/events", tags=["events"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=EventResponse)
async def create_event(
    request: CreateEventRequest,
    service: EventService = Depends(get_event_service),
    user: CurrentUser = Depends(get_current_user),
) -> EventResponse:
    return await service.create(request, user)


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: int,
    service: EventService = Depends(get_event_service),
) -> EventResponse:
    return await service.get_by_id(event_id)
