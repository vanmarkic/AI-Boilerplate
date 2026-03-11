from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from core.base_schema import ResponseBase


class CreateEventRequest(BaseModel):
    title: str
    description: str
    event_time: str
    status: Literal["upcoming", "in-progress", "completed"] = "upcoming"
    event_type: Literal["meeting", "deadline", "milestone", "notification"]
    badge_variant: Literal["default", "secondary", "destructive", "outline"] = "default"


class EventResponse(ResponseBase):
    id: int
    title: str
    description: str
    event_time: str
    status: str
    event_type: str
    badge_variant: str
    created_at: datetime


class ListEventsResponse(BaseModel):
    items: list[EventResponse]
    total: int
