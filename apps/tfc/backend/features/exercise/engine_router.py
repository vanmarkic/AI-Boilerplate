"""REST endpoints for engine control (start, pause, resume, reset, etc.).

All endpoints operate on the in-memory ExerciseEngine via session_store.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.dependencies import get_exercise_service
from engine.exercise_engine import EngineConfig
from engine.session_store import session_store
from features.exercise.exercise_service import ExerciseService

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


# ── Lifecycle ────────────────────────────────────────────────────────────


@router.post("/start", operation_id="startEngine")
async def start_engine(
    exercise_id: int,
    service: ExerciseService = Depends(get_exercise_service),
) -> dict:
    engine = session_store.get(exercise_id)
    if engine is None:
        exercise = await service.get_exercise(exercise_id)
        config = EngineConfig(
            exercise_id=exercise.id,
            title=exercise.title,
            time_factor=exercise.time_factor,
        )
        engine = session_store.create(config)
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


@router.post(
    "/events/{event_id}/trigger",
    operation_id="triggerEvent",
)
async def trigger_event(exercise_id: int, event_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    result = engine.event_scheduler.force_trigger(event_id, pt)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found or not triggerable",
        )
    return result


@router.post(
    "/events/{event_id}/cancel",
    operation_id="cancelEvent",
)
async def cancel_event(exercise_id: int, event_id: str) -> dict:
    engine = _get_engine(exercise_id)
    result = engine.event_scheduler.cancel_event(event_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found or not cancellable",
        )
    return result


@router.post(
    "/events/{event_id}/complete",
    operation_id="completeEvent",
)
async def complete_event(exercise_id: int, event_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    result = engine.event_scheduler.complete_event(event_id, pt)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found or not completable",
        )
    return result


# ── Issue actions ────────────────────────────────────────────────────────


@router.post(
    "/issues/{issue_id}/activate",
    operation_id="activateIssue",
)
async def activate_issue(exercise_id: int, issue_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    result = engine.issue_manager.manual_activate(issue_id, pt)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Issue {issue_id} not found or not activatable",
        )
    return result


@router.post(
    "/issues/{issue_id}/mitigate",
    operation_id="mitigateIssue",
)
async def mitigate_issue(exercise_id: int, issue_id: str) -> dict:
    engine = _get_engine(exercise_id)
    result = engine.issue_manager.mitigate(issue_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Issue {issue_id} not found or not mitigatable",
        )
    return result


@router.post(
    "/issues/{issue_id}/resolve",
    operation_id="resolveIssue",
)
async def resolve_issue(exercise_id: int, issue_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    result = engine.issue_manager.resolve(issue_id, pt)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Issue {issue_id} not found or not resolvable",
        )
    return result


@router.post(
    "/issues/{issue_id}/release",
    operation_id="releaseIssue",
)
async def release_issue(exercise_id: int, issue_id: str) -> dict:
    engine = _get_engine(exercise_id)
    result = engine.issue_manager.release_to_players(issue_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Issue {issue_id} not found or not releasable",
        )
    return result
