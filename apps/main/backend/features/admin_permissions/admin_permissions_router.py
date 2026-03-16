from fastapi import APIRouter, Depends, status

from core.auth import CurrentUser, get_current_user
from core.dependencies import get_admin_permissions_service
from core.rbac import clear_permissions_cache
from features.admin_permissions.admin_permissions_schema import (
    FrontendPermissionsResponse,
    PermissionCreate,
    PermissionResponse,
    PermissionUpdate,
)
from features.admin_permissions.admin_permissions_service import (
    AdminPermissionsService,
)

router = APIRouter(tags=["permissions"])


@router.get(
    "/api/admin/permissions",
    response_model=list[PermissionResponse],
)
async def list_permissions(
    offset: int = 0,
    limit: int = 100,
    service: AdminPermissionsService = Depends(get_admin_permissions_service),
    user: CurrentUser = Depends(get_current_user),
) -> list[PermissionResponse]:
    """List all role-permission mappings."""
    return await service.list_permissions(offset, limit)


@router.post(
    "/api/admin/permissions",
    status_code=status.HTTP_201_CREATED,
    response_model=PermissionResponse,
)
async def create_permission(
    request: PermissionCreate,
    service: AdminPermissionsService = Depends(get_admin_permissions_service),
    user: CurrentUser = Depends(get_current_user),
) -> PermissionResponse:
    """Create a new role-permission mapping."""
    return await service.create_permission(request, user)


@router.put(
    "/api/admin/permissions/{perm_id}",
    response_model=PermissionResponse,
)
async def update_permission(
    perm_id: int,
    request: PermissionUpdate,
    service: AdminPermissionsService = Depends(get_admin_permissions_service),
    user: CurrentUser = Depends(get_current_user),
) -> PermissionResponse:
    """Update an existing role-permission mapping."""
    return await service.update_permission(perm_id, request, user)


@router.delete(
    "/api/admin/permissions/{perm_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_permission(
    perm_id: int,
    service: AdminPermissionsService = Depends(get_admin_permissions_service),
    user: CurrentUser = Depends(get_current_user),
) -> None:
    """Delete a role-permission mapping."""
    await service.delete_permission(perm_id, user)


@router.post(
    "/api/admin/permissions/reload",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def reload_permissions(
    user: CurrentUser = Depends(get_current_user),
) -> None:
    """Force-refresh the in-memory RBAC permission cache."""
    clear_permissions_cache()


@router.get(
    "/api/me/permissions",
    response_model=FrontendPermissionsResponse,
)
async def get_my_permissions(
    service: AdminPermissionsService = Depends(get_admin_permissions_service),
    user: CurrentUser = Depends(get_current_user),
) -> FrontendPermissionsResponse:
    """Return the frontend routes accessible to the current user."""
    routes = await service.get_frontend_routes(user.roles)
    return FrontendPermissionsResponse(routes=routes)
