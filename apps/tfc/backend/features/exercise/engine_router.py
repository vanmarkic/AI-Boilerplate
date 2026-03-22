"""REST endpoints for engine lifecycle and decision handling.

Entity-level actions (events, issues) live in engine_actions_router.py.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.dependencies import get_exercise_service, get_scenario_service
from engine.exercise_engine import EngineConfig, EnginePhase, EngineStateError, ExerciseEngine
from engine.session_store import session_store
from engine.state_changes import DecisionSnapshot, EngineSnapshot, PhaseChange, StateChange
from features.audit.audit_repository import AuditRepository
from features.audit.audit_service import AuditService
from features.exercise.adapters.connection_manager import connection_manager
from features.exercise.engine_broadcast import broadcast_changes
from features.exercise.engine_decision_service import EngineDecisionService
from features.exercise.exercise_service import ExerciseService
from features.exercise.exercise_session_service import ExerciseSessionService
from features.scenario.scenario_content import ScenarioContent
from features.scenario.scenario_loader import build_engine_config
from features.scenario.scenario_service import ScenarioService
from features.waiting_room.waiting_room_store import waiting_room_store

router = APIRouter(prefix="/api/exercises/{exercise_id}/engine", tags=["engine"])


async def _log_to_audit(
    exercise_id: int,
    changes: list[StateChange],
) -> None:
    """Persist state changes to the audit trail in a dedicated session."""
    import logging

    from core.database import async_session_factory

    engine = session_store.get(exercise_id)
    if not engine:
        return
    try:
        async with async_session_factory() as session:
            async with session.begin():
                audit = AuditService(AuditRepository(session))
                await audit.log_engine_changes(
                    exercise_id,
                    changes,
                    play_time_ms=engine.time_manager.play_time_ms,
                    real_time_ms=engine.time_manager.real_time_ms,
                )
    except Exception:
        logging.getLogger(__name__).warning(
            "Failed to write audit log for exercise %s",
            exercise_id,
            exc_info=True,
        )


class SpeedRequest(BaseModel):
    factor: float = Field(..., gt=0)


class CloseDecisionRequest(BaseModel):
    selected_option_ids: list[str] = Field(default_factory=list)
    target_system_selections: dict[str, str] = Field(default_factory=dict)


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
    exercise: object,
    scenario_service: ScenarioService,
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
    return build_engine_config(
        exercise_id=exercise.id,
        title=exercise.title,
        content=content,
        practice_mode=exercise.practice_mode,
    )


@router.post("/start", operation_id="startEngine")
async def start_engine(
    exercise_id: int,
    service: ExerciseService = Depends(get_exercise_service),
    scenario_service: ScenarioService = Depends(get_scenario_service),
) -> PhaseChange:
    engine = session_store.get(exercise_id)
    if engine is None:
        exercise = await service.get_exercise(exercise_id)
        config = await _build_config(exercise, scenario_service)

        async def _on_change(changes: list[StateChange]) -> None:
            await broadcast_changes(connection_manager, exercise_id, changes)
            await _log_to_audit(exercise_id, changes)

        engine = session_store.create(config, on_state_change=_on_change)

    # Idempotent: if already in briefing or running, return current phase
    if engine.phase in {EnginePhase.BRIEFING, EnginePhase.RUNNING}:
        return engine._phase_change("started")

    try:
        result = await engine.start()
    except EngineStateError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    await _log_to_audit(exercise_id, [result])

    # Notify all WS clients so lobby players auto-navigate
    participants = waiting_room_store.list_participants(exercise_id)
    await connection_manager.broadcast(
        exercise_id,
        {
            "type": "exercise_started",
            "exercise_id": exercise_id,
            "participants": [p.to_dict() for p in participants],
        },
    )
    return result


@router.post("/begin", operation_id="beginEngine")
async def begin_engine(exercise_id: int) -> PhaseChange:
    """Transition BRIEFING → RUNNING after the player has read the briefing."""
    try:
        result = await _get_engine(exercise_id).begin()
    except EngineStateError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    await broadcast_changes(connection_manager, exercise_id, [result])
    await _log_to_audit(exercise_id, [result])
    return result


@router.post("/pause", operation_id="pauseEngine")
async def pause_engine(exercise_id: int) -> PhaseChange:
    try:
        result = await _get_engine(exercise_id).pause()
    except EngineStateError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    await broadcast_changes(connection_manager, exercise_id, [result])
    await _log_to_audit(exercise_id, [result])
    return result


@router.post("/resume", operation_id="resumeEngine")
async def resume_engine(exercise_id: int) -> PhaseChange:
    try:
        result = await _get_engine(exercise_id).resume()
    except EngineStateError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    await broadcast_changes(connection_manager, exercise_id, [result])
    await _log_to_audit(exercise_id, [result])
    return result


@router.post("/reset", operation_id="resetEngine")
async def reset_engine(exercise_id: int) -> PhaseChange:
    result = await _get_engine(exercise_id).reset()
    await broadcast_changes(connection_manager, exercise_id, [result])
    await _log_to_audit(exercise_id, [result])
    return result


@router.post("/complete", operation_id="completeEngine")
async def complete_engine(exercise_id: int) -> PhaseChange:
    svc = ExerciseSessionService(session_store, connection_manager, waiting_room_store)
    result = await svc.complete(
        exercise_id,
        broadcast_fn=lambda changes: broadcast_changes(connection_manager, exercise_id, changes),
        audit_fn=_log_to_audit,
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot complete exercise",
        )
    return result


@router.post("/stop", operation_id="stopEngine")
async def stop_engine(exercise_id: int) -> dict[str, bool]:
    """Force-stop an exercise: complete engine, close all WS, flush waiting room."""
    svc = ExerciseSessionService(session_store, connection_manager, waiting_room_store)
    await svc.stop(exercise_id, reason="stopped_by_gm")
    return {"stopped": True}


@router.put("/speed", operation_id="setEngineSpeed")
async def set_engine_speed(exercise_id: int, body: SpeedRequest) -> StateChange:
    return _get_engine(exercise_id).set_speed(body.factor)


@router.get("/snapshot", operation_id="getEngineSnapshot")
async def get_engine_snapshot(exercise_id: int) -> EngineSnapshot:
    return _get_engine(exercise_id).snapshot()


@router.get("/decisions", operation_id="getEngineDecisions")
async def get_engine_decisions(exercise_id: int) -> list[DecisionSnapshot]:
    """Return all decisions (open and closed) from the running engine."""
    return _get_engine(exercise_id).decision_manager.snapshot()


@router.post("/decisions/{decision_id}/close", operation_id="closeDecision")
async def close_decision(
    exercise_id: int,
    decision_id: str,
    body: CloseDecisionRequest,
) -> StateChange:
    engine = _get_engine(exercise_id)

    all_changes: list[StateChange] = []

    async def _broadcast(changes: list[StateChange]) -> None:
        all_changes.extend(changes)
        await broadcast_changes(connection_manager, exercise_id, changes)

    svc = EngineDecisionService()
    result = await svc.close_decision(
        engine,
        decision_id,
        body.selected_option_ids,
        broadcast=_broadcast,
        target_system_selections=body.target_system_selections or None,
    )
    await _log_to_audit(exercise_id, all_changes)
    return result


@router.post("/decisions/recommend", operation_id="submitRecommendation")
async def submit_recommendation(
    exercise_id: int,
    body: RecommendRequest,
) -> StateChange:
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
    await broadcast_changes(connection_manager, exercise_id, [result])
    await _log_to_audit(exercise_id, [result])
    return result


@router.get("/context", operation_id="getEngineContext")
async def get_engine_context(exercise_id: int) -> dict[str, object]:
    """Return scenario context (title, briefing, roles, etc.) for the running engine."""
    engine = _get_engine(exercise_id)
    ctx = engine.config.context
    return {
        "title": ctx.title,
        "description": ctx.description,
        "briefing": ctx.briefing,
        "objectives": ctx.objectives,
        "rules": ctx.rules,
        "default_time_factor": engine.config.time_factor,
        "roles": [{"id": r.id, "label": r.label, "player_type": r.player_type} for r in ctx.roles],
        "score_tier_thresholds": ctx.score_tier_thresholds,
        "stress_effect_preset": ctx.stress_effect_preset,
    }
