from fastapi import APIRouter, Depends, status

from core.auth import CurrentUser, get_current_user
from core.dependencies import get_admin_users_service
from features.admin_users.admin_users_schema import (
    KeycloakRoleResponse,
    KeycloakUserListResponse,
    RoleAssignRequest,
    RoleCreateRequest,
    RoleListResponse,
)
from features.admin_users.admin_users_service import AdminUsersService

router = APIRouter(tags=["admin-users"])


@router.get(
    "/api/admin/users",
    response_model=KeycloakUserListResponse,
)
async def list_users(
    search: str | None = None,
    offset: int = 0,
    limit: int = 50,
    service: AdminUsersService = Depends(get_admin_users_service),
    user: CurrentUser = Depends(get_current_user),
) -> KeycloakUserListResponse:
    """List Keycloak users with their roles."""
    return await service.list_users(search, offset, limit)


@router.get(
    "/api/admin/users/{user_id}/roles",
    response_model=list[str],
)
async def get_user_roles(
    user_id: str,
    service: AdminUsersService = Depends(get_admin_users_service),
    user: CurrentUser = Depends(get_current_user),
) -> list[str]:
    """Get realm roles for a specific user."""
    return await service.get_user_roles(user_id)


@router.post(
    "/api/admin/users/{user_id}/roles",
    response_model=list[str],
)
async def assign_roles(
    user_id: str,
    request: RoleAssignRequest,
    service: AdminUsersService = Depends(get_admin_users_service),
    user: CurrentUser = Depends(get_current_user),
) -> list[str]:
    """Assign realm roles to a user."""
    return await service.assign_roles(user_id, request.role_names, user)


@router.delete(
    "/api/admin/users/{user_id}/roles",
    response_model=list[str],
)
async def remove_roles(
    user_id: str,
    request: RoleAssignRequest,
    service: AdminUsersService = Depends(get_admin_users_service),
    user: CurrentUser = Depends(get_current_user),
) -> list[str]:
    """Remove realm roles from a user."""
    return await service.remove_roles(user_id, request.role_names, user)


@router.get(
    "/api/admin/roles",
    response_model=RoleListResponse,
)
async def list_roles(
    service: AdminUsersService = Depends(get_admin_users_service),
    user: CurrentUser = Depends(get_current_user),
) -> RoleListResponse:
    """List all realm roles."""
    return await service.list_roles()


@router.post(
    "/api/admin/roles",
    status_code=status.HTTP_201_CREATED,
    response_model=KeycloakRoleResponse,
)
async def create_role(
    request: RoleCreateRequest,
    service: AdminUsersService = Depends(get_admin_users_service),
    user: CurrentUser = Depends(get_current_user),
) -> KeycloakRoleResponse:
    """Create a new realm role."""
    return await service.create_role(request.name, request.description, user)


@router.delete(
    "/api/admin/roles/{role_name}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_role(
    role_name: str,
    service: AdminUsersService = Depends(get_admin_users_service),
    user: CurrentUser = Depends(get_current_user),
) -> None:
    """Delete a realm role."""
    await service.delete_role(role_name, user)
