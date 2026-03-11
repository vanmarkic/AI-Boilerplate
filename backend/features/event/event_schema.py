from datetime import datetime

from pydantic import BaseModel, Field

from core.base_schema import ResponseBase


class CreateEventRequest(BaseModel):
    timestamp: datetime
    event_type: str = Field(..., min_length=1, max_length=50)
    severity: str = Field(..., pattern="^(info|warning|error|critical)$")
    description: str = Field(..., min_length=1, max_length=500)
    metadata: dict = Field(default_factory=dict)


class EventResponse(ResponseBase):
    id: int
    timestamp: datetime
    event_type: str
    severity: str
    description: str
    created_by: str
    metadata: dict
    created_at: datetime
