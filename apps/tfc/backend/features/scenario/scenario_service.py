from fastapi import HTTPException, status

from features.scenario.scenario_model import Scenario
from features.scenario.scenario_repository import ScenarioRepository
from features.scenario.scenario_schema import (
    CreateScenarioRequest,
    ScenarioResponse,
    UpdateScenarioRequest,
)


class ScenarioService:
    def __init__(self, repository: ScenarioRepository) -> None:
        self.repository = repository

    async def create_scenario(
        self, request: CreateScenarioRequest,
    ) -> ScenarioResponse:
        scenario = Scenario(
            title=request.title,
            description=request.description,
            content=request.content,
            version=request.version,
        )
        created = await self.repository.create(scenario)
        return ScenarioResponse.model_validate(created)

    async def get_scenario(self, scenario_id: int) -> ScenarioResponse:
        scenario = await self.repository.get_by_id(scenario_id)
        if not scenario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Scenario not found",
            )
        return ScenarioResponse.model_validate(scenario)

    async def list_scenarios(self) -> list[ScenarioResponse]:
        scenarios = await self.repository.list()
        return [ScenarioResponse.model_validate(s) for s in scenarios]

    async def update_scenario(
        self, scenario_id: int, request: UpdateScenarioRequest,
    ) -> ScenarioResponse:
        scenario = await self.repository.get_by_id(scenario_id)
        if not scenario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Scenario not found",
            )

        update_data = request.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(scenario, field, value)

        updated = await self.repository.update(scenario)
        return ScenarioResponse.model_validate(updated)

    async def delete_scenario(self, scenario_id: int) -> None:
        deleted = await self.repository.delete(scenario_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Scenario not found",
            )
