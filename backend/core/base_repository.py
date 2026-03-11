from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import Base

T = TypeVar("T", bound=Base)


class CrudRepository(Generic[T]):
    """Generic CRUD repository for SQLAlchemy models.

    Subclass and pass the model type:
        class OrderRepository(CrudRepository[Order]):
            def __init__(self, session: AsyncSession) -> None:
                super().__init__(session, Order)
    """

    def __init__(self, session: AsyncSession, model_class: type[T]) -> None:
        self.session = session
        self.model_class = model_class

    async def get_by_id(self, entity_id: int) -> T | None:
        return await self.session.get(self.model_class, entity_id)

    async def list(self, offset: int = 0, limit: int = 100) -> list[T]:
        stmt = select(self.model_class).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, entity: T) -> T:
        self.session.add(entity)
        await self.session.flush()
        await self.session.refresh(entity)
        return entity

    async def delete(self, entity_id: int) -> bool:
        entity = await self.get_by_id(entity_id)
        if entity is None:
            return False
        await self.session.delete(entity)
        await self.session.flush()
        return True
