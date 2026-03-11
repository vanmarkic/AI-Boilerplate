from datetime import datetime
from pydantic import BaseModel, Field

from core.base_schema import ResponseBase


class CreateIncidentRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    severity: str = Field(..., pattern="^(critical|high|medium|low)$")
    started_at: datetime


class UpdateIncidentRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, min_length=1)
    severity: str | None = Field(None, pattern="^(critical|high|medium|low)$")
    status: str | None = Field(None, pattern="^(ongoing|resolved)$")
    ended_at: datetime | None = None


class IncidentResponse(ResponseBase):
    id: int
    title: str
    description: str
    severity: str
    status: str
    started_at: datetime
    ended_at: datetime | None
    created_at: datetime
    updated_at: datetime
