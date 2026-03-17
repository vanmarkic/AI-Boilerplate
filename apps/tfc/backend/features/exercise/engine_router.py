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


class RecommendRequest(BaseModel):
    decision_id: str
    option_id: str


def _get_engine(exercise_id: int):
    engine = session_store.get(exercise_id)
    if engine is None:
        raise HTTPException(status_code=404, detail=f"No engine for exercise {exercise_id}")
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
            return build_engine_config(exercise_id=exercise.id, title=exercise.title, content=content)
    return EngineConfig(exercise_id=exercise.id, title=exercise.title, time_factor=exercise.time_factor)



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



@router.put("/speed", operation_id="setEngineSpeed")
async def set_engine_speed(exercise_id: int, body: SpeedRequest) -> dict:
    return _get_engine(exercise_id).set_speed(body.factor)



@router.get("/snapshot", operation_id="getEngineSnapshot")
async def get_engine_snapshot(exercise_id: int) -> dict:
    return _get_engine(exercise_id).snapshot()



def _or_404(result: dict | None, detail: str) -> dict:
    if result is None:
        raise HTTPException(status_code=404, detail=detail)
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



@router.get("/decisions", operation_id="getOpenDecisions")
async def get_open_decisions(exercise_id: int) -> list[dict]:
    engine = _get_engine(exercise_id)
    return [
        {"id": d.id, "title": d.title, "question_type": d.question_type,
         "options": d.options, "target_roles": d.target_roles, "status": d.status,
         "recommendations": dict(d.recommendations)}
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
    # Let game mode react (scoring, penalties)
    extra = engine.game_mode.on_decision_closed(decision_id, 0.0, 0.0)
    if extra:
        await connection_manager.broadcast(
            exercise_id, {"type": "state_changes", "changes": extra},
        )
    # Resume if classic mode and no other open decisions remain
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
        body.decision_id, participant_id="TODO", option_id=body.option_id,
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
