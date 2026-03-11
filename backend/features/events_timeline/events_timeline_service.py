from fastapi import HTTPException, status

from features.events_timeline.events_timeline_model import EventsTimeline
from features.events_timeline.events_timeline_repository import EventsTimelineRepository
from features.events_timeline.events_timeline_schema import CreateEventsTimelineRequest, EventsTimelineResponse


class EventsTimelineService:
    def __init__(self, repository: EventsTimelineRepository) -> None:
        self.repository = repository

    async def create(self, request: CreateEventsTimelineRequest) -> EventsTimelineResponse:
        entity = EventsTimeline(
            title=request.title,
            description=request.description,
            event_date=request.event_date,
            event_type=request.event_type,
            location=request.location,
            url=request.url,
            status=request.status,
        )
        created = await self.repository.create(entity)
        return EventsTimelineResponse.model_validate(created)

    async def get_by_id(self, events_timeline_id: int) -> EventsTimelineResponse:
        entity = await self.repository.get_by_id(events_timeline_id)
        if not entity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="EventsTimeline not found",
            )
        return EventsTimelineResponse.model_validate(entity)

    async def get_all(self) -> list[EventsTimelineResponse]:
        entities = await self.repository.get_all()
        return [EventsTimelineResponse.model_validate(e) for e in entities]
