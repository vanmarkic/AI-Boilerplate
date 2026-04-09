"""REST endpoints for engine entity actions (injects, defects, decisions).

Split from engine_router.py to stay under the 250-line limit.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from engine.session_store import session_store

router = APIRouter(prefix="/api/exercises/{exercise_id}/engine", tags=["engine"])


class DelayRequest(BaseModel):
    delay_ms: float = Field(..., gt=0)


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
    return _or_404(
        _get_engine(exercise_id).inject_scheduler.cancel_inject(inject_id),
        f"Inject {inject_id} not found or not cancellable",
    )


@router.post("/injects/{inject_id}/complete", operation_id="completeInject")
async def complete_inject(exercise_id: int, inject_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    return _or_404(
        engine.inject_scheduler.complete_inject(inject_id, pt),
        f"Inject {inject_id} not found or not completable",
    )


@router.post("/injects/{inject_id}/pause", operation_id="pauseInject")
async def pause_inject(exercise_id: int, inject_id: str) -> dict:
    return _or_404(
        _get_engine(exercise_id).inject_scheduler.pause_inject(inject_id),
        f"Inject {inject_id} not found or not pausable",
    )


@router.post("/injects/{inject_id}/resume", operation_id="resumeInject")
async def resume_inject(exercise_id: int, inject_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    return _or_404(
        engine.inject_scheduler.resume_inject(inject_id, pt),
        f"Inject {inject_id} not found or not resumable",
    )


@router.post("/injects/{inject_id}/delay", operation_id="delayInject")
async def delay_inject(
    exercise_id: int, inject_id: str, body: DelayRequest,
) -> dict:
    return _or_404(
        _get_engine(exercise_id).inject_scheduler.delay_inject(
            inject_id, body.delay_ms,
        ),
        f"Inject {inject_id} not found or not delayable",
    )


@router.post("/injects/{inject_id}/skip", operation_id="skipInject")
async def skip_inject(exercise_id: int, inject_id: str) -> dict:
    return _or_404(
        _get_engine(exercise_id).inject_scheduler.skip_inject(inject_id),
        f"Inject {inject_id} not found or not skippable",
    )


# ── Defect actions ───────────────────────────────────────────────────────


@router.post("/defects/{defect_id}/activate", operation_id="activateDefect")
async def activate_defect(exercise_id: int, defect_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    return _or_404(
        engine.defect_manager.manual_activate(defect_id, pt),
        f"Defect {defect_id} not found or not activatable",
    )


@router.post("/defects/{defect_id}/mitigate", operation_id="mitigateDefect")
async def mitigate_defect(exercise_id: int, defect_id: str) -> dict:
    return _or_404(
        _get_engine(exercise_id).defect_manager.mitigate(defect_id),
        f"Defect {defect_id} not found or not mitigatable",
    )


@router.post("/defects/{defect_id}/resolve", operation_id="resolveDefect")
async def resolve_defect(exercise_id: int, defect_id: str) -> dict:
    engine = _get_engine(exercise_id)
    pt = engine.time_manager.play_time_ms
    return _or_404(
        engine.defect_manager.resolve(defect_id, pt),
        f"Defect {defect_id} not found or not resolvable",
    )


@router.post("/defects/{defect_id}/release", operation_id="releaseDefect")
async def release_defect(exercise_id: int, defect_id: str) -> dict:
    return _or_404(
        _get_engine(exercise_id).defect_manager.release_to_players(defect_id),
        f"Defect {defect_id} not found or not releasable",
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
