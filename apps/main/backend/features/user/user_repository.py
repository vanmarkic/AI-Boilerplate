from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_repository import CrudRepository
from features.user.user_model import User


class UserRepository(CrudRepository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, User)

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
