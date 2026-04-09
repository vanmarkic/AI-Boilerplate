from sqlalchemy.ext.asyncio import AsyncSession

from core.base_repository import CrudRepository
from features.scenario.scenario_model import Scenario


class ScenarioRepository(CrudRepository[Scenario]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Scenario)
