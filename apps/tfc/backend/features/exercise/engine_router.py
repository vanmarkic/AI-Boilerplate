"""REST endpoints for engine lifecycle (start, pause, resume, reset, etc.).

Entity-level actions (events, issues, decisions) live in
engine_actions_router.py.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.dependencies import get_exercise_service, get_scenario_service
from features.exercise.adapters.connection_manager import (
    connection_manager,
    ConnectionManager,
)
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


def _split_targeted_changes(
    changes: list[dict],
) -> tuple[list[tuple[list[str], list[dict]]], list[dict]]:
    """Split changes into role-targeted decisions and general changes."""
    general: list[dict] = []
    by_roles: dict[tuple[str, ...], list[dict]] = {}
    for change in changes:
        target_roles = change.get("target_roles", [])
        if change.get("type") == "decision_opened" and target_roles:
            key = tuple(sorted(target_roles))
            by_roles.setdefault(key, []).append(change)
        else:
            general.append(change)
    targeted = [(list(k), v) for k, v in by_roles.items()]
    return targeted, general


async def _broadcast_to_roles(
    mgr: ConnectionManager,
    exercise_id: int,
    roles: list[str],
    changes: list[dict],
) -> None:
    """Broadcast changes to specific roles + always to gm."""
    msg = {"type": "state_changes", "changes": changes}
    for role in roles:
        await mgr.broadcast_to_role(exercise_id, role, msg)
    if "gm" not in roles:
        await mgr.broadcast_to_role(exercise_id, "gm", msg)


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
            targeted, general = _split_targeted_changes(changes)
            if general:
                await connection_manager.broadcast(
                    exercise_id,
                    {"type": "state_changes", "changes": general},
                )
            for roles, role_changes in targeted:
                await _broadcast_to_roles(
                    connection_manager, exercise_id, roles, role_changes,
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
