"""REST endpoints for engine entity actions (injects, defects, decisions).

Split from engine_router.py for separation of concerns.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from engine.session_store import session_store

router = APIRouter(prefix="/api/exercises/{exercise_id}/engine", tags=["engine"])


class DelayRequest(BaseModel):
    delay_ms: float = Field(..., gt=0)


class RecommendationRequest(BaseModel):
    role: str = Field(..., min_length=1)
    participant_id: str = Field(..., min_length=1)


def _get_engine(exercise_id: int):
    """Retrieve engine or raise 404."""
    engine = session_store.get(exercise_id)
    if engine is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active engine for exercise {exercise_id}",
        )
    return engine


def _or_404(result: dict | None, detail: str) -> dict:
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return result


# ── Inject actions ───────────────────────────────────────────────────────


@router.post("/injects/{inject_id}/trigger", operation_id="triggerInject")
async def trigger_inject(exercise_id: int, inject_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    return _or_404(
        engine.inject_scheduler.force_trigger(inject_id, pt),
        f"Inject {inject_id} not found or not triggerable",
    )


@router.post("/injects/{inject_id}/cancel", operation_id="cancelInject")
async def cancel_inject(exercise_id: int, inject_id: str) -> dict:
    engine = _get_engine(exercise_id)
    change = _or_404(
        engine.inject_scheduler.cancel_inject(inject_id),
        f"Inject {inject_id} not found or not cancellable",
    )
    await engine.broadcast_changes([change])
    return change


@router.post("/injects/{inject_id}/complete", operation_id="completeInject")
async def complete_inject(exercise_id: int, inject_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    change = _or_404(
        engine.inject_scheduler.complete_inject(inject_id, pt),
        f"Inject {inject_id} not found or not completable",
    )
    await engine.broadcast_changes([change])
    return change


@router.post("/injects/{inject_id}/pause", operation_id="pauseInject")
async def pause_inject(exercise_id: int, inject_id: str) -> dict:
    engine = _get_engine(exercise_id)
    change = _or_404(
        engine.inject_scheduler.pause_inject(inject_id),
        f"Inject {inject_id} not found or not pausable",
    )
    await engine.broadcast_changes([change])
    return change


@router.post("/injects/{inject_id}/resume", operation_id="resumeInject")
async def resume_inject(exercise_id: int, inject_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    change = _or_404(
        engine.inject_scheduler.resume_inject(inject_id, pt),
        f"Inject {inject_id} not found or not resumable",
    )
    await engine.broadcast_changes([change])
    return change


@router.post("/injects/{inject_id}/delay", operation_id="delayInject")
async def delay_inject(
    exercise_id: int, inject_id: str, body: DelayRequest,
) -> dict:
    engine = _get_engine(exercise_id)
    change = _or_404(
        engine.inject_scheduler.delay_inject(inject_id, body.delay_ms),
        f"Inject {inject_id} not found or not delayable",
    )
    await engine.broadcast_changes([change])
    return change


@router.post("/injects/{inject_id}/skip", operation_id="skipInject")
async def skip_inject(exercise_id: int, inject_id: str) -> dict:
    engine = _get_engine(exercise_id)
    change = _or_404(
        engine.inject_scheduler.skip_inject(inject_id),
        f"Inject {inject_id} not found or not skippable",
    )
    await engine.broadcast_changes([change])
    return change


# ── Defect actions ───────────────────────────────────────────────────────


@router.post("/defects/{defect_id}/activate", operation_id="activateDefect")
async def activate_defect(exercise_id: int, defect_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    change = _or_404(
        engine.defect_manager.manual_activate(defect_id, pt),
        f"Defect {defect_id} not found or not activatable",
    )
    await engine.broadcast_changes([change])
    return change


@router.post("/defects/{defect_id}/mitigate", operation_id="mitigateDefect")
async def mitigate_defect(exercise_id: int, defect_id: str) -> dict:
    engine = _get_engine(exercise_id)
    change = _or_404(
        engine.defect_manager.mitigate(defect_id),
        f"Defect {defect_id} not found or not mitigatable",
    )
    await engine.broadcast_changes([change])
    return change


@router.post("/defects/{defect_id}/resolve", operation_id="resolveDefect")
async def resolve_defect(exercise_id: int, defect_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    change = _or_404(
        engine.defect_manager.resolve(defect_id, pt),
        f"Defect {defect_id} not found or not resolvable",
    )
    await engine.broadcast_changes([change])
    return change


@router.post("/defects/{defect_id}/release", operation_id="releaseDefect")
async def release_defect(exercise_id: int, defect_id: str) -> dict:
    engine = _get_engine(exercise_id)
    change = _or_404(
        engine.defect_manager.release_to_players(defect_id),
        f"Defect {defect_id} not found or not releasable",
    )
    await engine.broadcast_changes([change])
    return change


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
    if not engine.decision_manager.get_open_decisions():
        await engine.resume()
    return result


@router.post(
    "/decisions/{decision_id}/recommendations",
    operation_id="submitDecisionRecommendation",
    status_code=status.HTTP_201_CREATED,
)
async def submit_decision_recommendation(
    exercise_id: int,
    decision_id: str,
    body: RecommendationRequest,
) -> dict:
    """Record a role recommendation and auto-close if all_respond is satisfied."""
    engine = _get_engine(exercise_id)
    dm = engine.decision_manager
    open_ids = {d.id for d in dm.get_open_decisions()}
    if decision_id not in open_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Decision {decision_id} not found or already closed",
        )
    dm.record_recommendation(
        decision_id, role=body.role, participant_id=body.participant_id,
    )
    auto_closed: dict | None = None
    decision = dm._decisions.get(decision_id)
    if (
        decision is not None
        and decision.completion_mode == "all_respond"
        and dm.all_target_roles_responded(decision_id)
    ):
        pt = engine.time_manager.play_time_ms
        auto_closed = dm.close_decision(decision_id, current_pt_ms=pt)
        if auto_closed and not dm.get_open_decisions():
            await engine.resume()
    return {"recorded": True, "auto_closed": auto_closed is not None}


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
