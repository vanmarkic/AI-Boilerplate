from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_repository import CrudRepository
from features.domain_config.domain_config_model import DomainConfig


class DomainConfigRepository(CrudRepository[DomainConfig]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, DomainConfig)

    async def get_by_slug(self, slug: str) -> DomainConfig | None:
        stmt = select(DomainConfig).where(DomainConfig.slug == slug)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
