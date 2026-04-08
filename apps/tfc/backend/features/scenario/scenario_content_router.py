"""CRUD endpoints for individual entities within a scenario's content JSON.

Allows adding, updating, and deleting events (injects), issues (defects),
and decision templates without replacing the entire content blob.
"""

from fastapi import APIRouter, Depends, status

from core.dependencies import get_scenario_service
from features.scenario.scenario_content import (
    DecisionTemplateDef,
    ScenarioEventDef,
    ScenarioIssueDef,
)
from features.scenario.scenario_schema import ScenarioResponse
from features.scenario.scenario_service import ScenarioService

router = APIRouter(
    prefix="/api/scenarios/{scenario_id}/content",
    tags=["scenario-content"],
)


# ---------------------------------------------------------------------------
# Events (injects)
# ---------------------------------------------------------------------------


@router.post(
    "/events",
    status_code=status.HTTP_201_CREATED,
    response_model=ScenarioResponse,
    operation_id="addScenarioEvent",
)
async def add_event(
    scenario_id: int,
    body: ScenarioEventDef,
    service: ScenarioService = Depends(get_scenario_service),
) -> ScenarioResponse:
    """Add a new inject to the scenario content."""
    return await service.add_content_entity(scenario_id, "events", body)


@router.put(
    "/events/{eid}",
    response_model=ScenarioResponse,
    operation_id="updateScenarioEvent",
)
async def update_event(
    scenario_id: int,
    eid: str,
    body: ScenarioEventDef,
    service: ScenarioService = Depends(get_scenario_service),
) -> ScenarioResponse:
    """Update an existing inject in the scenario content."""
    return await service.update_content_entity(scenario_id, "events", eid, body)


@router.delete(
    "/events/{eid}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteScenarioEvent",
)
async def delete_event(
    scenario_id: int,
    eid: str,
    service: ScenarioService = Depends(get_scenario_service),
) -> None:
    """Remove an inject from the scenario content."""
    await service.delete_content_entity(scenario_id, "events", eid)


# ---------------------------------------------------------------------------
# Issues (defects)
# ---------------------------------------------------------------------------


@router.post(
    "/issues",
    status_code=status.HTTP_201_CREATED,
    response_model=ScenarioResponse,
    operation_id="addScenarioIssue",
)
async def add_issue(
    scenario_id: int,
    body: ScenarioIssueDef,
    service: ScenarioService = Depends(get_scenario_service),
) -> ScenarioResponse:
    """Add a new defect to the scenario content."""
    return await service.add_content_entity(scenario_id, "issues", body)


@router.put(
    "/issues/{iid}",
    response_model=ScenarioResponse,
    operation_id="updateScenarioIssue",
)
async def update_issue(
    scenario_id: int,
    iid: str,
    body: ScenarioIssueDef,
    service: ScenarioService = Depends(get_scenario_service),
) -> ScenarioResponse:
    """Update an existing defect in the scenario content."""
    return await service.update_content_entity(scenario_id, "issues", iid, body)


@router.delete(
    "/issues/{iid}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteScenarioIssue",
)
async def delete_issue(
    scenario_id: int,
    iid: str,
    service: ScenarioService = Depends(get_scenario_service),
) -> None:
    """Remove a defect from the scenario content."""
    await service.delete_content_entity(scenario_id, "issues", iid)


# ---------------------------------------------------------------------------
# Decision templates
# ---------------------------------------------------------------------------


@router.post(
    "/decisions",
    status_code=status.HTTP_201_CREATED,
    response_model=ScenarioResponse,
    operation_id="addScenarioDecision",
)
async def add_decision(
    scenario_id: int,
    body: DecisionTemplateDef,
    service: ScenarioService = Depends(get_scenario_service),
) -> ScenarioResponse:
    """Add a new decision template to the scenario content."""
    return await service.add_content_entity(
        scenario_id, "decision_templates", body,
    )


@router.put(
    "/decisions/{did}",
    response_model=ScenarioResponse,
    operation_id="updateScenarioDecision",
)
async def update_decision(
    scenario_id: int,
    did: str,
    body: DecisionTemplateDef,
    service: ScenarioService = Depends(get_scenario_service),
) -> ScenarioResponse:
    """Update an existing decision template in the scenario content."""
    return await service.update_content_entity(
        scenario_id, "decision_templates", did, body,
    )


@router.delete(
    "/decisions/{did}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteScenarioDecision",
)
async def delete_decision(
    scenario_id: int,
    did: str,
    service: ScenarioService = Depends(get_scenario_service),
) -> None:
    """Remove a decision template from the scenario content."""
    await service.delete_content_entity(scenario_id, "decision_templates", did)
