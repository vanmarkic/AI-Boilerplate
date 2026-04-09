from datetime import datetime

from pydantic import BaseModel

from core.base_schema import ResponseBase


class TerminologyPayload(BaseModel):
    event: str
    issue: str
    player: str
    trainer: str
    exercise: str
    scenario: str
    decision: str


class SeverityLevelPayload(BaseModel):
    id: str
    label: str
    color: str
    order: int


class SystemDefPayload(BaseModel):
    id: str
    label: str
    description: str = ""
    category: str = "system"  # "system" | "weapon"


class WarfareDomainPayload(BaseModel):
    id: str
    label: str
    description: str = ""


class BlueCardPayload(BaseModel):
    id: str
    title: str
    description: str = ""
    targets_system: bool = False


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
    systems: list[SystemDefPayload] = []
    warfare_domains: list[WarfareDomainPayload] = []
    blue_card_catalog: list[BlueCardPayload] = []


class UpdateDomainConfigRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    terminology: TerminologyPayload | None = None
    theme: ThemePayload | None = None
    roles: list[RolePayload] | None = None
    severity_levels: list[SeverityLevelPayload] | None = None
    systems: list[SystemDefPayload] | None = None
    warfare_domains: list[WarfareDomainPayload] | None = None
    blue_card_catalog: list[BlueCardPayload] | None = None


class DomainConfigResponse(ResponseBase):
    id: int
    slug: str
    name: str
    description: str
    terminology: TerminologyPayload
    theme: ThemePayload
    roles: list[RolePayload]
    severity_levels: list[SeverityLevelPayload]
    systems: list[SystemDefPayload] = []  # noqa: RUF012
    warfare_domains: list[WarfareDomainPayload] = []  # noqa: RUF012
    blue_card_catalog: list[BlueCardPayload] = []  # noqa: RUF012
    created_at: datetime
    updated_at: datetime
