from datetime import datetime

from pydantic import BaseModel

from core.base_schema import ResponseBase


class CreateExerciseRequest(BaseModel):
    title: str
    description: str = ""
    phase: str = "setup"
    scenario_id: int | None = None
    domain_id: int | None = None
    time_factor: float = 1.0


class UpdateExerciseRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    phase: str | None = None
    scenario_id: int | None = None
    domain_id: int | None = None
    time_factor: float | None = None


class ExerciseResponse(ResponseBase):
    id: int
    title: str
    description: str
    phase: str
    scenario_id: int | None
    domain_id: int | None
    time_factor: float
    created_at: datetime
    updated_at: datetime
