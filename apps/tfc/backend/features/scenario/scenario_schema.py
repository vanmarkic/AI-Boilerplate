from datetime import datetime
from typing import Any

from pydantic import BaseModel, model_validator

from core.base_schema import ResponseBase
from features.scenario.scenario_content import ScenarioContent


class CreateScenarioRequest(BaseModel):
    title: str
    description: str = ""
    content: dict[str, Any] | None = None
    version: int = 1

    @model_validator(mode="after")
    def validate_content(self) -> "CreateScenarioRequest":
        """If content is provided, validate it against ScenarioContent."""
        if self.content is not None:
            ScenarioContent.model_validate(self.content)
        return self


class UpdateScenarioRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    content: dict[str, Any] | None = None
    version: int | None = None

    @model_validator(mode="after")
    def validate_content(self) -> "UpdateScenarioRequest":
        """If content is provided, validate it against ScenarioContent."""
        if self.content is not None:
            ScenarioContent.model_validate(self.content)
        return self


class ScenarioResponse(ResponseBase):
    id: int
    title: str
    description: str
    content: dict[str, Any] | None
    version: int
    created_at: datetime
    updated_at: datetime
