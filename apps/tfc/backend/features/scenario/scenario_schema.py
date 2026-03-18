from datetime import datetime

from pydantic import BaseModel

from core.base_schema import ResponseBase
from features.scenario.scenario_content import ScenarioContent


class CreateScenarioRequest(BaseModel):
    title: str
    description: str = ""
    domain_id: int | None = None
    content: ScenarioContent
    version: int = 1


class UpdateScenarioRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    domain_id: int | None = None
    content: ScenarioContent | None = None
    version: int | None = None


class ScenarioResponse(ResponseBase):
    id: int
    title: str
    description: str
    domain_id: int | None
    content: ScenarioContent | None
    version: int
    created_at: datetime
    updated_at: datetime
