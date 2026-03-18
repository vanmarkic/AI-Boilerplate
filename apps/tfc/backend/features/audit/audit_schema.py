from datetime import datetime

from pydantic import BaseModel

from core.base_schema import ResponseBase


class CreateAuditEntry(BaseModel):
    exercise_id: int
    entry_type: str
    action: str
    actor_id: str | None = None
    actor_name: str | None = None
    target_type: str | None = None
    target_id: str | None = None
    play_time_ms: float = 0.0
    real_time_ms: float = 0.0
    details: dict[str, object] | None = None


class AuditEntryResponse(ResponseBase):
    id: int
    exercise_id: int
    entry_type: str
    action: str
    actor_id: str | None
    actor_name: str | None
    target_type: str | None
    target_id: str | None
    play_time_ms: float
    real_time_ms: float
    details: dict[str, object] | None
    created_at: datetime
