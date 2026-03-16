from fastapi import HTTPException, status

from core.auth import CurrentUser
from core.keycloak_admin import KeycloakAdminClient
from features.admin_users.admin_users_schema import (
    KeycloakRoleResponse,
    KeycloakUserListResponse,
    KeycloakUserResponse,
    RoleListResponse,
)

PROTECTED_ROLES: frozenset[str] = frozenset({"admin", "role_manager"})
UNDELETABLE_ROLES: frozenset[str] = frozenset({"admin", "role_manager", "user"})


class AdminUsersService:
    """Business logic for Keycloak user and role management."""

    def __init__(self, kc: KeycloakAdminClient) -> None:
        self.kc = kc

    async def list_users(
        self, search: str | None, offset: int, limit: int
    ) -> KeycloakUserListResponse:
        """List Keycloak users with their roles."""
        users = await self.kc.list_users(search, offset, limit)
        total = await self.kc.count_users(search)
        result: list[KeycloakUserResponse] = []
        for u in users:
            roles_data = await self.kc.get_user_roles(str(u["id"]))
            role_names = [str(r["name"]) for r in roles_data]
            result.append(
                KeycloakUserResponse(
                    id=str(u["id"]),
                    username=str(u.get("username", "")),
                    email=str(u["email"]) if u.get("email") else None,
                    enabled=bool(u.get("enabled", False)),
                    roles=role_names,
                )
            )
        return KeycloakUserListResponse(users=result, total=total)

    async def get_user_roles(self, user_id: str) -> list[str]:
        """Get role names for a user."""
        roles = await self.kc.get_user_roles(user_id)
        return [str(r["name"]) for r in roles]

    async def assign_roles(
        self,
        user_id: str,
        role_names: list[str],
        current_user: CurrentUser,
    ) -> list[str]:
        """Assign roles to a user. Returns updated role list."""
        self._check_can_manage_roles(current_user)
        self._check_protected_role_assignment(role_names, current_user)
        roles_to_assign = []
        for name in role_names:
            role = await self.kc.get_role_by_name(name)
            roles_to_assign.append(
                {"id": str(role["id"]), "name": str(role["name"])}
            )
        await self.kc.assign_roles(user_id, roles_to_assign)
        return await self.get_user_roles(user_id)

    async def remove_roles(
        self,
        user_id: str,
        role_names: list[str],
        current_user: CurrentUser,
    ) -> list[str]:
        """Remove roles from a user. Returns updated role list."""
        self._check_can_manage_roles(current_user)
        self._check_protected_role_assignment(role_names, current_user)
        roles_to_remove = []
        for name in role_names:
            role = await self.kc.get_role_by_name(name)
            roles_to_remove.append(
                {"id": str(role["id"]), "name": str(role["name"])}
            )
        await self.kc.remove_roles(user_id, roles_to_remove)
        return await self.get_user_roles(user_id)

    async def list_roles(self) -> RoleListResponse:
        """List all realm roles."""
        roles = await self.kc.list_realm_roles()
        return RoleListResponse(
            roles=[
                KeycloakRoleResponse(
                    id=str(r["id"]),
                    name=str(r["name"]),
                    description=str(r.get("description", ""))
                    if r.get("description")
                    else None,
                )
                for r in roles
            ]
        )

    async def create_role(
        self,
        name: str,
        description: str,
        current_user: CurrentUser,
    ) -> KeycloakRoleResponse:
        """Create a new realm role. Admin only."""
        self._check_is_admin(current_user)
        role = await self.kc.create_realm_role(name, description)
        return KeycloakRoleResponse(
            id=str(role["id"]),
            name=str(role["name"]),
            description=str(role.get("description", ""))
            if role.get("description")
            else None,
        )

    async def delete_role(
        self, name: str, current_user: CurrentUser
    ) -> None:
        """Delete a realm role. Admin only. Cannot delete protected roles."""
        self._check_is_admin(current_user)
        if name in UNDELETABLE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Cannot delete protected role '{name}'",
            )
        await self.kc.delete_realm_role(name)

    def _check_can_manage_roles(self, user: CurrentUser) -> None:
        """Verify user has admin or role_manager role."""
        if "admin" not in user.roles and "role_manager" not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Requires admin or role_manager role",
            )

    def _check_protected_role_assignment(
        self, role_names: list[str], user: CurrentUser
    ) -> None:
        """Block non-admin from assigning/removing protected roles."""
        protected = [r for r in role_names if r in PROTECTED_ROLES]
        if protected and "admin" not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Only admin can assign/remove protected roles: "
                    + ", ".join(protected)
                ),
            )

    def _check_is_admin(self, user: CurrentUser) -> None:
        """Verify user has admin role."""
        if "admin" not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can perform this action",
            )
