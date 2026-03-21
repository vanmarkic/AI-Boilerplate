from fastapi import APIRouter, Depends, status

from core.dependencies import get_scenario_service
from features.scenario.scenario_schema import (
    CreateScenarioRequest,
    ScenarioResponse,
    UpdateScenarioRequest,
)
from features.scenario.scenario_service import ScenarioService

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=ScenarioResponse,
    operation_id="createScenario",
)
async def create_scenario(
    request: CreateScenarioRequest,
    service: ScenarioService = Depends(get_scenario_service),
) -> ScenarioResponse:
    return await service.create_scenario(request)


@router.get(
    "",
    response_model=list[ScenarioResponse],
    operation_id="listScenarios",
)
async def list_scenarios(
    domain_id: int | None = None,
    service: ScenarioService = Depends(get_scenario_service),
) -> list[ScenarioResponse]:
    return await service.list_scenarios(domain_id)


@router.get(
    "/{scenario_id}",
    response_model=ScenarioResponse,
    operation_id="getScenario",
)
async def get_scenario(
    scenario_id: int,
    service: ScenarioService = Depends(get_scenario_service),
) -> ScenarioResponse:
    return await service.get_scenario(scenario_id)


@router.put(
    "/{scenario_id}",
    response_model=ScenarioResponse,
    operation_id="updateScenario",
)
async def update_scenario(
    scenario_id: int,
    request: UpdateScenarioRequest,
    service: ScenarioService = Depends(get_scenario_service),
) -> ScenarioResponse:
    return await service.update_scenario(scenario_id, request)


@router.post(
    "/{scenario_id}/clone",
    status_code=status.HTTP_201_CREATED,
    response_model=ScenarioResponse,
    operation_id="cloneScenario",
)
async def clone_scenario(
    scenario_id: int,
    service: ScenarioService = Depends(get_scenario_service),
) -> ScenarioResponse:
    return await service.clone_scenario(scenario_id)


@router.delete(
    "/{scenario_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteScenario",
)
async def delete_scenario(
    scenario_id: int,
    service: ScenarioService = Depends(get_scenario_service),
) -> None:
    await service.delete_scenario(scenario_id)
