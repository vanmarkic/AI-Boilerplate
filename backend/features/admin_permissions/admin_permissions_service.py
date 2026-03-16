from fastapi import HTTPException, status

from core.auth import CurrentUser
from core.rbac_model import RolePermission
from core.rbac_repository import RbacRepository
from features.admin_permissions.admin_permissions_schema import (
    PermissionCreate,
    PermissionResponse,
    PermissionUpdate,
)

PROTECTED_ROLES: frozenset[str] = frozenset({"admin", "role_manager"})


class AdminPermissionsService:
    """Business logic for role-permission management."""

    def __init__(self, repository: RbacRepository) -> None:
        self.repository = repository

    async def list_permissions(
        self, offset: int, limit: int
    ) -> list[PermissionResponse]:
        """Return paginated list of all role-permission mappings."""
        perms = await self.repository.list(offset, limit)
        return [PermissionResponse.model_validate(p) for p in perms]

    async def create_permission(
        self, request: PermissionCreate, current_user: CurrentUser
    ) -> PermissionResponse:
        """Create a new role-permission mapping."""
        self._check_protected_role(request.role, current_user)
        entity = RolePermission(**request.model_dump())
        created = await self.repository.create(entity)
        return PermissionResponse.model_validate(created)

    async def update_permission(
        self,
        perm_id: int,
        request: PermissionUpdate,
        current_user: CurrentUser,
    ) -> PermissionResponse:
        """Update an existing role-permission mapping."""
        existing = await self.repository.get_by_id(perm_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Permission not found",
            )
        self._check_protected_role(existing.role, current_user)
        if request.role is not None:
            self._check_protected_role(request.role, current_user)
        for field, value in request.model_dump(exclude_unset=True).items():
            setattr(existing, field, value)
        await self.repository.session.flush()
        await self.repository.session.refresh(existing)
        return PermissionResponse.model_validate(existing)

    async def delete_permission(
        self, perm_id: int, current_user: CurrentUser
    ) -> bool:
        """Delete a role-permission mapping."""
        existing = await self.repository.get_by_id(perm_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Permission not found",
            )
        self._check_protected_role(existing.role, current_user)
        return await self.repository.delete(perm_id)

    async def get_frontend_routes(self, roles: list[str]) -> list[str]:
        """Return deduplicated frontend routes for the given roles."""
        return await self.repository.get_frontend_routes_for_roles(roles)

    def _check_protected_role(
        self, role: str, user: CurrentUser
    ) -> None:
        """Block non-admin users from modifying protected role permissions."""
        if role in PROTECTED_ROLES and "admin" not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Only admin can modify permissions for "
                    f"protected role '{role}'"
                ),
            )
