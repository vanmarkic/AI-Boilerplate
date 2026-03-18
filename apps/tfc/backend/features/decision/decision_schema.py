from datetime import datetime

from pydantic import BaseModel

from core.base_schema import ResponseBase
from features.scenario.scenario_content import DecisionOptionDef


class CreateDecisionRequest(BaseModel):
    title: str
    description: str = ""
    exercise_id: int
    issue_id: str
    question_type: str
    options: list[DecisionOptionDef] = []
    completion_mode: str


class SubmitResponseRequest(BaseModel):
    participant_id: str
    participant_name: str
    selected_options: list[str] | None = None
    free_text: str | None = None


class ResponseItem(ResponseBase):
    id: int
    participant_name: str
    selected_options: list[str] | None
    free_text: str | None
    score: float | None
    submitted_at: datetime


class DecisionResponse(ResponseBase):
    id: int
    exercise_id: int
    issue_id: str
    title: str
    description: str
    question_type: str
    options: list[DecisionOptionDef] | None
    completion_mode: str
    status: str
    created_at: datetime
    closed_at: datetime | None
    responses_count: int = 0


class DecisionDetailResponse(ResponseBase):
    id: int
    exercise_id: int
    issue_id: str
    title: str
    description: str
    question_type: str
    options: list[DecisionOptionDef] | None
    completion_mode: str
    status: str
    created_at: datetime
    closed_at: datetime | None
    responses: list[ResponseItem] = []
