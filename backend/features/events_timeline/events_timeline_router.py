from fastapi import APIRouter, Depends, status

from core.dependencies import get_events_timeline_service
from features.events_timeline.events_timeline_schema import CreateEventsTimelineRequest, EventsTimelineResponse
from features.events_timeline.events_timeline_service import EventsTimelineService

router = APIRouter(prefix="/api/events_timelines", tags=["events_timelines"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=EventsTimelineResponse)
async def create_events_timeline(
    request: CreateEventsTimelineRequest,
    service: EventsTimelineService = Depends(get_events_timeline_service),
) -> EventsTimelineResponse:
    return await service.create(request)


@router.get("", response_model=list[EventsTimelineResponse])
async def list_events_timelines(
    service: EventsTimelineService = Depends(get_events_timeline_service),
) -> list[EventsTimelineResponse]:
    return await service.get_all()


@router.get("/{events_timeline_id}", response_model=EventsTimelineResponse)
async def get_events_timeline(
    events_timeline_id: int,
    service: EventsTimelineService = Depends(get_events_timeline_service),
) -> EventsTimelineResponse:
    return await service.get_by_id(events_timeline_id)
