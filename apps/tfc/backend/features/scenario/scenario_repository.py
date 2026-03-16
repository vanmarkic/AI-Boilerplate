from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_repository import CrudRepository
from features.scenario.scenario_model import Scenario


class ScenarioRepository(CrudRepository[Scenario]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Scenario)

    async def list_by_domain(self, domain_id: int) -> list[Scenario]:
        """List scenarios filtered by domain_id."""
        stmt = select(Scenario).where(Scenario.domain_id == domain_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
