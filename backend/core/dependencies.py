"""Dependency injection factories for feature services.

Each factory wires Session → Repository → Service.
Uses lazy imports (inside function body) so tier-excluded features
don't break at module import time. New factories are auto-appended
by scaffold-feature.sh — no need to edit this file manually.
"""
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_session


async def get_user_service(
    session: AsyncSession = Depends(get_session),
) -> "UserService":  # noqa: F821
    """Wire up the UserService with its repository."""
    from features.user.user_repository import UserRepository
    from features.user.user_service import UserService

    repository = UserRepository(session)
    return UserService(repository)


async def get_admin_permissions_service(
    session: AsyncSession = Depends(get_session),
) -> "AdminPermissionsService":  # noqa: F821
    """Wire up the AdminPermissionsService with its repository."""
    from core.rbac_repository import RbacRepository
    from features.admin_permissions.admin_permissions_service import (
        AdminPermissionsService,
    )

    repository = RbacRepository(session)
    return AdminPermissionsService(repository)
