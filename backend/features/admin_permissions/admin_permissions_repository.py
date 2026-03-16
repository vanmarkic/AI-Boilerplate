from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_repository import CrudRepository
from features.admin_permissions.admin_permissions_model import RolePermission


class AdminPermissionsRepository(CrudRepository[RolePermission]):
    """Repository for role-permission CRUD and role-based queries."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, RolePermission)

    async def get_frontend_routes_for_roles(
        self, roles: list[str]
    ) -> list[str]:
        """Return deduplicated frontend routes for the given roles."""
        stmt = (
            select(RolePermission.frontend_route)
            .where(RolePermission.role.in_(roles))
            .where(RolePermission.frontend_route.is_not(None))
            .distinct()
        )
        result = await self.session.execute(stmt)
        return [row[0] for row in result.all() if row[0] is not None]
