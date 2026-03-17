from datetime import datetime
from typing import Any

from pydantic import BaseModel

from core.base_schema import ResponseBase


class TerminologyPayload(BaseModel):
    event: str
    issue: str
    player: str
    gameMaster: str
    exercise: str
    scenario: str
    decision: str


class SeverityLevelPayload(BaseModel):
    id: str
    label: str
    color: str
    order: int


class RolePayload(BaseModel):
    id: str
    label: str
    description: str


class ThemePayload(BaseModel):
    colorPrimary: str
    colorSecondary: str
    colorBackground: str
    colorForeground: str
    fontFamily: str
    fontFamilyMono: str
    density: str


class CreateDomainConfigRequest(BaseModel):
    slug: str
    name: str
    description: str = ""
    terminology: TerminologyPayload
    theme: ThemePayload
    roles: list[RolePayload]
    severity_levels: list[SeverityLevelPayload]


class UpdateDomainConfigRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    terminology: TerminologyPayload | None = None
    theme: ThemePayload | None = None
    roles: list[RolePayload] | None = None
    severity_levels: list[SeverityLevelPayload] | None = None


class DomainConfigResponse(ResponseBase):
    id: int
    slug: str
    name: str
    description: str
    terminology: dict[str, Any]
    theme: dict[str, Any]
    roles: list[dict[str, Any]]
    severity_levels: list[dict[str, Any]]
    created_at: datetime
    updated_at: datetime
