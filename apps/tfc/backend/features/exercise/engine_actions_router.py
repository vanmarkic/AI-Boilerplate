"""REST endpoints for engine entity actions (events, issues, decisions).

Split from engine_router.py to stay under the 250-line limit.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from engine.exercise_engine import ExerciseEngine
from engine.session_store import session_store
from engine.state_changes import EventChange, IssueChange, StateChange

router = APIRouter(prefix="/api/exercises/{exercise_id}/engine", tags=["engine"])


class DelayRequest(BaseModel):
    delay_ms: float = Field(..., gt=0)


def _get_engine(exercise_id: int) -> ExerciseEngine:
    """Retrieve engine or raise 404."""
    engine = session_store.get(exercise_id)
    if engine is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active engine for exercise {exercise_id}",
        )
    return engine


def _or_404[T: StateChange](result: T | None, detail: str) -> T:
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return result


# ── Event actions ────────────────────────────────────────────────────────


@router.post("/events/{event_id}/trigger", operation_id="triggerEvent")
async def trigger_event(exercise_id: int, event_id: str) -> EventChange:
    engine = _get_engine(exercise_id)
    try:
        changes = engine.trigger_event(event_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc),
        ) from exc
    if changes and engine._on_state_change:
        await engine._on_state_change(changes)
    return changes[0]  # EventChange is always first


@router.post("/events/{event_id}/cancel", operation_id="cancelEvent")
async def cancel_event(exercise_id: int, event_id: str) -> EventChange:
    return _or_404(
        _get_engine(exercise_id).event_scheduler.cancel_event(event_id),
        f"Event {event_id} not found or not cancellable",
    )


@router.post("/events/{event_id}/complete", operation_id="completeEvent")
async def complete_event(exercise_id: int, event_id: str) -> EventChange:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    return _or_404(
        engine.event_scheduler.complete_event(event_id, pt),
        f"Event {event_id} not found or not completable",
    )


@router.post("/events/{event_id}/pause", operation_id="pauseEvent")
async def pause_event(exercise_id: int, event_id: str) -> EventChange:
    return _or_404(
        _get_engine(exercise_id).event_scheduler.pause_event(event_id),
        f"Event {event_id} not found or not pausable",
    )


@router.post("/events/{event_id}/resume", operation_id="resumeEvent")
async def resume_event(exercise_id: int, event_id: str) -> EventChange:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    return _or_404(
        engine.event_scheduler.resume_event(event_id, pt),
        f"Event {event_id} not found or not resumable",
    )


@router.post("/events/{event_id}/delay", operation_id="delayEvent")
async def delay_event(
    exercise_id: int,
    event_id: str,
    body: DelayRequest,
) -> EventChange:
    return _or_404(
        _get_engine(exercise_id).event_scheduler.delay_event(
            event_id,
            body.delay_ms,
        ),
        f"Event {event_id} not found or not delayable",
    )


@router.post("/events/{event_id}/skip", operation_id="skipEvent")
async def skip_event(exercise_id: int, event_id: str) -> EventChange:
    return _or_404(
        _get_engine(exercise_id).event_scheduler.skip_event(event_id),
        f"Event {event_id} not found or not skippable",
    )


# ── Issue actions ────────────────────────────────────────────────────────


@router.post("/issues/{issue_id}/activate", operation_id="activateIssue")
async def activate_issue(exercise_id: int, issue_id: str) -> IssueChange:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    return _or_404(
        engine.issue_manager.manual_activate(issue_id, pt),
        f"Issue {issue_id} not found or not activatable",
    )


@router.post("/issues/{issue_id}/mitigate", operation_id="mitigateIssue")
async def mitigate_issue(exercise_id: int, issue_id: str) -> IssueChange:
    return _or_404(
        _get_engine(exercise_id).issue_manager.mitigate(issue_id),
        f"Issue {issue_id} not found or not mitigatable",
    )


@router.post("/issues/{issue_id}/resolve", operation_id="resolveIssue")
async def resolve_issue(exercise_id: int, issue_id: str) -> IssueChange:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    return _or_404(
        engine.issue_manager.resolve(issue_id, pt),
        f"Issue {issue_id} not found or not resolvable",
    )


@router.post("/issues/{issue_id}/release", operation_id="releaseIssue")
async def release_issue(exercise_id: int, issue_id: str) -> IssueChange:
    return _or_404(
        _get_engine(exercise_id).issue_manager.release_to_players(issue_id),
        f"Issue {issue_id} not found or not releasable",
    )


# ── Decision actions ─────────────────────────────────────────────────────


@router.get("/decisions", operation_id="getOpenDecisions")
async def get_open_decisions(exercise_id: int) -> list[dict[str, object]]:
    engine = _get_engine(exercise_id)
    return [
        {
            "id": d.id,
            "event_id": d.event_id,
            "title": d.title,
            "question_type": d.question_type,
            "options": d.options,
            "target_roles": d.target_roles,
            "status": d.status,
        }
        for d in engine.decision_manager.get_open_decisions()
    ]

    # close_decision endpoint has been consolidated into engine_router.py
    # to support scoring, turn chaining, and forced card enforcement.


# ── Context ──────────────────────────────────────────────────────────────


@router.get("/context", operation_id="getEngineContext")
async def get_engine_context(exercise_id: int) -> dict[str, object]:
    engine = _get_engine(exercise_id)
    ctx = engine.config.context
    return {
        "title": ctx.title,
        "description": ctx.description,
        "briefing": ctx.briefing,
        "objectives": ctx.objectives,
        "rules": ctx.rules,
        "roles": [
            {"id": r.id, "label": r.label, "player_type": r.player_type}
            for r in ctx.roles
        ],
        "default_time_factor": engine.config.time_factor,
        "score_tier_thresholds": ctx.score_tier_thresholds,
    }
