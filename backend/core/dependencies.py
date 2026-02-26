from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_session
from features.user.user_repository import UserRepository
from features.user.user_service import UserService


async def get_user_service(
    session: AsyncSession = Depends(get_session),
) -> UserService:
    """Wire up the UserService with its repository."""
    repository = UserRepository(session)
    return UserService(repository)
