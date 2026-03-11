from datetime import datetime

from pydantic import BaseModel

from core.base_schema import ResponseBase


class CreateEventsTimelineRequest(BaseModel):
    title: str
    description: str
    event_date: datetime
    event_type: str
    location: str | None = None
    url: str | None = None
    status: str = "upcoming"


class EventsTimelineResponse(ResponseBase):
    id: int
    title: str
    description: str
    event_date: datetime
    event_type: str
    location: str | None
    url: str | None
    status: str
    created_at: datetime
