from datetime import datetime

from pydantic import BaseModel

from core.base_schema import ResponseBase


class PermissionCreate(BaseModel):
    """Request body for creating a role-permission mapping."""

    role: str
    route_pattern: str
    method: str
    frontend_route: str | None = None


class PermissionUpdate(BaseModel):
    """Request body for updating a role-permission mapping."""

    role: str | None = None
    route_pattern: str | None = None
    method: str | None = None
    frontend_route: str | None = None


class PermissionResponse(ResponseBase):
    """Response body for a role-permission mapping."""

    id: int
    role: str
    route_pattern: str
    method: str
    frontend_route: str | None
    created_at: datetime
    updated_at: datetime


class FrontendPermissionsResponse(ResponseBase):
    """Response body for the current user's allowed frontend routes."""

    routes: list[str]
