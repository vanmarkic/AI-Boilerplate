from pydantic import BaseModel, Field

from core.base_schema import ResponseBase


class RoleAssignRequest(BaseModel):
    """Request body for assigning/removing roles."""

    role_names: list[str] = Field(min_length=1)


class RoleCreateRequest(BaseModel):
    """Request body for creating a new realm role."""

    name: str = Field(min_length=1, max_length=50, pattern=r"^[a-z][a-z0-9_]*$")
    description: str = ""


class KeycloakUserResponse(ResponseBase):
    """Response body for a Keycloak user."""

    id: str
    username: str
    email: str | None = None
    enabled: bool
    roles: list[str] = []


class KeycloakUserListResponse(BaseModel):
    """Paginated list of Keycloak users."""

    users: list[KeycloakUserResponse]
    total: int


class KeycloakRoleResponse(ResponseBase):
    """Response body for a Keycloak realm role."""

    id: str
    name: str
    description: str | None = None


class RoleListResponse(BaseModel):
    """List of realm roles."""

    roles: list[KeycloakRoleResponse]
