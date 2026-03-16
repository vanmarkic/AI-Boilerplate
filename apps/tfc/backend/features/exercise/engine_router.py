"""REST endpoints for engine control (start, pause, resume, reset, etc.).

All endpoints operate on the in-memory ExerciseEngine via session_store.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.dependencies import get_exercise_service, get_scenario_service
from engine.connection_manager import connection_manager
from engine.exercise_engine import EngineConfig
from engine.session_store import session_store
from features.exercise.exercise_service import ExerciseService
from features.scenario.scenario_content import ScenarioContent
from features.scenario.scenario_loader import build_engine_config
from features.scenario.scenario_service import ScenarioService

router = APIRouter(prefix="/api/exercises/{exercise_id}/engine", tags=["engine"])


class SpeedRequest(BaseModel):
    factor: float = Field(..., gt=0)


def _get_engine(exercise_id: int):
    """Retrieve engine or raise 404."""
    engine = session_store.get(exercise_id)
    if engine is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active engine for exercise {exercise_id}",
        )
    return engine


async def _build_config(
    exercise: object, scenario_service: ScenarioService,
) -> EngineConfig:
    """Build EngineConfig, loading scenario content if linked."""
    if hasattr(exercise, "scenario_id") and exercise.scenario_id is not None:
        scenario = await scenario_service.get_scenario(exercise.scenario_id)
        if scenario.content:
            content = ScenarioContent.model_validate(scenario.content)
            return build_engine_config(
                exercise_id=exercise.id,
                title=exercise.title,
                content=content,
            )
    return EngineConfig(
        exercise_id=exercise.id,
        title=exercise.title,
        time_factor=exercise.time_factor,
    )


# ── Lifecycle ────────────────────────────────────────────────────────────


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

        async def _broadcast_changes(changes: list[dict]) -> None:
            await connection_manager.broadcast(
                exercise_id,
                {"type": "state_changes", "changes": changes},
            )

        engine = session_store.create(
            config, on_state_change=_broadcast_changes
        )
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


# ── Speed ────────────────────────────────────────────────────────────────


@router.put("/speed", operation_id="setEngineSpeed")
async def set_engine_speed(exercise_id: int, body: SpeedRequest) -> dict:
    return _get_engine(exercise_id).set_speed(body.factor)


# ── Snapshot ─────────────────────────────────────────────────────────────


@router.get("/snapshot", operation_id="getEngineSnapshot")
async def get_engine_snapshot(exercise_id: int) -> dict:
    return _get_engine(exercise_id).snapshot()


# ── Event actions ────────────────────────────────────────────────────────


def _or_404(result: dict | None, detail: str) -> dict:
    """Return result or raise 404."""
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return result


@router.post("/events/{event_id}/trigger", operation_id="triggerEvent")
async def trigger_event(exercise_id: int, event_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    return _or_404(
        engine.event_scheduler.force_trigger(event_id, pt),
        f"Event {event_id} not found or not triggerable",
    )


@router.post("/events/{event_id}/cancel", operation_id="cancelEvent")
async def cancel_event(exercise_id: int, event_id: str) -> dict:
    return _or_404(
        _get_engine(exercise_id).event_scheduler.cancel_event(event_id),
        f"Event {event_id} not found or not cancellable",
    )


@router.post("/events/{event_id}/complete", operation_id="completeEvent")
async def complete_event(exercise_id: int, event_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    return _or_404(
        engine.event_scheduler.complete_event(event_id, pt),
        f"Event {event_id} not found or not completable",
    )


# ── Issue actions ────────────────────────────────────────────────────────


@router.post("/issues/{issue_id}/activate", operation_id="activateIssue")
async def activate_issue(exercise_id: int, issue_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    return _or_404(
        engine.issue_manager.manual_activate(issue_id, pt),
        f"Issue {issue_id} not found or not activatable",
    )


@router.post("/issues/{issue_id}/mitigate", operation_id="mitigateIssue")
async def mitigate_issue(exercise_id: int, issue_id: str) -> dict:
    return _or_404(
        _get_engine(exercise_id).issue_manager.mitigate(issue_id),
        f"Issue {issue_id} not found or not mitigatable",
    )


@router.post("/issues/{issue_id}/resolve", operation_id="resolveIssue")
async def resolve_issue(exercise_id: int, issue_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    return _or_404(
        engine.issue_manager.resolve(issue_id, pt),
        f"Issue {issue_id} not found or not resolvable",
    )


@router.post("/issues/{issue_id}/release", operation_id="releaseIssue")
async def release_issue(exercise_id: int, issue_id: str) -> dict:
    return _or_404(
        _get_engine(exercise_id).issue_manager.release_to_players(issue_id),
        f"Issue {issue_id} not found or not releasable",
    )


# ── Decision actions ─────────────────────────────────────────────────────


@router.get("/decisions", operation_id="getOpenDecisions")
async def get_open_decisions(exercise_id: int) -> list[dict]:
    engine = _get_engine(exercise_id)
    return [
        {"id": d.id, "title": d.title, "question_type": d.question_type,
         "options": d.options, "target_roles": d.target_roles, "status": d.status}
        for d in engine.decision_manager.get_open_decisions()
    ]


@router.post("/decisions/{decision_id}/close", operation_id="closeDecision")
async def close_decision(exercise_id: int, decision_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    result = engine.decision_manager.close_decision(decision_id, current_pt_ms=pt)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Decision {decision_id} not found or already closed",
        )
    # Resume if no other open decisions remain
    if not engine.decision_manager.get_open_decisions():
        await engine.resume()
    return result


# ── Context ──────────────────────────────────────────────────────────────


@router.get("/context", operation_id="getEngineContext")
async def get_engine_context(exercise_id: int) -> dict:
    engine = _get_engine(exercise_id)
    ctx = engine._config.context
    return {
        "title": ctx.title,
        "description": ctx.description,
        "briefing": ctx.briefing,
        "objectives": ctx.objectives,
        "rules": ctx.rules,
        "default_time_factor": engine._config.time_factor,
    }
