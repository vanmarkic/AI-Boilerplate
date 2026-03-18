"""REST endpoints for engine lifecycle and decision handling.

Entity-level actions (events, issues) live in engine_actions_router.py.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.dependencies import get_exercise_service, get_scenario_service
from features.exercise.adapters.connection_manager import connection_manager
from features.exercise.engine_broadcast import broadcast_changes, broadcast_to_roles, split_targeted_changes
from engine.exercise_engine import EngineConfig, ExerciseEngine
from engine.session_store import session_store
from features.exercise.exercise_service import ExerciseService
from features.scenario.scenario_content import ScenarioContent
from features.scenario.scenario_loader import build_engine_config
from features.scenario.scenario_service import ScenarioService

router = APIRouter(prefix="/api/exercises/{exercise_id}/engine", tags=["engine"])


class SpeedRequest(BaseModel):
    factor: float = Field(..., gt=0)


class CloseDecisionRequest(BaseModel):
    selected_option_ids: list[str] = Field(default_factory=list)


class RecommendRequest(BaseModel):
    decision_id: str
    option_id: str
    participant_id: str = Field(..., min_length=1)
    role_id: str | None = None


def _get_engine(exercise_id: int) -> ExerciseEngine:
    engine = session_store.get(exercise_id)
    if engine is None:
        raise HTTPException(status_code=404, detail=f"No engine for exercise {exercise_id}")
    return engine


async def _build_config(
    exercise: object, scenario_service: ScenarioService,
) -> EngineConfig:
    """Build EngineConfig from a scenario-linked exercise."""
    if not hasattr(exercise, "scenario_id") or exercise.scenario_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Exercise must be linked to a scenario before starting.",
        )
    scenario = await scenario_service.get_scenario(exercise.scenario_id)
    if not scenario.content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Scenario has no content. Add events, roles, and decisions first.",
        )
    content = ScenarioContent.model_validate(scenario.content)
    return build_engine_config(exercise_id=exercise.id, title=exercise.title, content=content)


@router.post("/start", operation_id="startEngine")
async def start_engine(
    exercise_id: int,
    service: ExerciseService = Depends(get_exercise_service),
    scenario_service: ScenarioService = Depends(get_scenario_service),
) -> dict:
    engine = session_store.get(exercise_id)
    if engine is None:
        exercise = await service.get_exercise(exercise_id)
        config = await _build_config(exercise, scenario_service)

        async def _on_change(changes: list[dict]) -> None:
            await broadcast_changes(connection_manager, exercise_id, changes)

        engine = session_store.create(config, on_state_change=_on_change)
    return await engine.start()


@router.post("/pause", operation_id="pauseEngine")
async def pause_engine(exercise_id: int) -> dict:
    return await _get_engine(exercise_id).pause()


@router.post("/resume", operation_id="resumeEngine")
async def resume_engine(exercise_id: int) -> dict:
    return await _get_engine(exercise_id).resume()


@router.post("/reset", operation_id="resetEngine")
async def reset_engine(exercise_id: int) -> dict:
    return await _get_engine(exercise_id).reset()


@router.post("/complete", operation_id="completeEngine")
async def complete_engine(exercise_id: int) -> dict:
    return await _get_engine(exercise_id).complete()


@router.put("/speed", operation_id="setEngineSpeed")
async def set_engine_speed(exercise_id: int, body: SpeedRequest) -> dict:
    return _get_engine(exercise_id).set_speed(body.factor)


@router.get("/snapshot", operation_id="getEngineSnapshot")
async def get_engine_snapshot(exercise_id: int) -> dict:
    return _get_engine(exercise_id).snapshot()


@router.post("/decisions/{decision_id}/close", operation_id="closeDecision")
async def close_decision(
    exercise_id: int, decision_id: str, body: CloseDecisionRequest,
) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms

    decision = engine.decision_manager._decisions.get(decision_id)
    if decision is None or decision.status != "open":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Decision {decision_id} not found or already closed",
        )
    all_options = decision.options

    result = engine.decision_manager.close_decision(
        decision_id, current_pt_ms=pt, selected_option_ids=body.selected_option_ids,
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Decision {decision_id} not found or already closed",
        )

    selected_options = [o for o in all_options if o["id"] in body.selected_option_ids]
    template = engine._find_decision_template(decision_id)
    forced_ids = template.forced_option_ids if template else []

    extra = engine.game_mode.on_decision_closed_v2(
        decision_id, selected_options, all_options,
        forced_option_ids=forced_ids or None,
    )
    if extra:
        await connection_manager.broadcast(
            exercise_id, {"type": "state_changes", "changes": extra},
        )

    next_id = engine.game_mode.get_next_decision_id(decision_id)
    if next_id:
        next_template = engine._find_decision_template(next_id)
        if next_template:
            timeout_ms = engine.game_mode.get_decision_time_ms(int(next_template.timeout_ms))
            opened = engine.decision_manager.open_decision(
                id=next_template.id, event_id=None, issue_id=next_template.issue_id,
                title=next_template.title, description=next_template.description,
                question_type=next_template.question_type, options=next_template.options,
                completion_mode=next_template.completion_mode,
                target_roles=next_template.target_roles,
                timeout_ms=timeout_ms, current_pt_ms=pt,
            )
            await broadcast_changes(connection_manager, exercise_id, [opened])

    if engine.game_mode.requires_gm():
        if not engine.decision_manager.get_open_decisions():
            await engine.resume()
    return result


@router.post("/decisions/recommend", operation_id="submitRecommendation")
async def submit_recommendation(
    exercise_id: int, body: RecommendRequest,
) -> dict:
    """Advisor submits a recommendation on an open decision."""
    engine = _get_engine(exercise_id)
    result = engine.decision_manager.submit_recommendation(
        body.decision_id,
        participant_id=body.participant_id,
        option_id=body.option_id,
        role_id=body.role_id,
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Decision {body.decision_id} not found or already closed",
        )
    await connection_manager.broadcast(
        exercise_id, {"type": "state_changes", "changes": [result]},
    )
    return result


@router.get("/context", operation_id="getEngineContext")
async def get_engine_context(exercise_id: int) -> dict:
    """Return scenario context (title, briefing, roles, etc.) for the running engine."""
    engine = _get_engine(exercise_id)
    ctx = engine._config.context
    return {
        "title": ctx.title,
        "description": ctx.description,
        "briefing": ctx.briefing,
        "objectives": ctx.objectives,
        "rules": ctx.rules,
        "default_time_factor": engine._config.time_factor,
        "roles": [
            {"id": r.id, "label": r.label, "player_type": r.player_type}
            for r in ctx.roles
        ],
    }
