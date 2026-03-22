# Canonicalization Round 2 — Recommendation, Session Lifecycle, Completion Handling

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Canonicalize the 3 next-priority items from the TFC engine audit: recommendation submission, session start/stop/complete semantics, and frontend completion handling.

**Architecture:** Move recommendation through `broadcast_changes` + `_log_to_audit` like all other mutations. Consolidate session lifecycle into `ExerciseSessionService` so start/complete/stop have one orchestration owner. Merge two frontend completion paths into one `handleCompletion` helper.

**Tech Stack:** Python/FastAPI (backend), Angular/TypeScript (frontend)

---

### Task 1: Canonicalize recommendation submission

Recommendation is the only decision-related mutation that bypasses `broadcast_changes` and `_log_to_audit`. Fix: route it through the same broadcast helper.

**Files:**
- Modify: `apps/tfc/backend/features/exercise/engine_router.py:249-271`

**Step 1: Write the failing test**

File: `apps/tfc/backend/features/exercise/engine_broadcast_test.py` (append)

```python
@pytest.mark.asyncio
async def test_recommendation_uses_broadcast_changes(client: AsyncClient) -> None:
    """Recommendation must go through broadcast_changes, not raw connection_manager."""
    eid = await _create_exercise(client)
    # ... setup engine with open decision ...
    with patch("features.exercise.engine_router.broadcast_changes") as mock_bc:
        mock_bc.return_value = None
        resp = await client.post(
            f"/api/exercises/{eid}/engine/decisions/recommend",
            json={"decision_id": "d1", "option_id": "good", "participant_id": "p1"},
        )
    assert mock_bc.called
```

**Step 2: Run test to verify it fails**

Run: `cd apps/tfc/backend && .venv/bin/python -m pytest -xvs features/exercise/engine_broadcast_test.py::test_recommendation_uses_broadcast_changes`
Expected: FAIL — currently calls `connection_manager.broadcast` directly

**Step 3: Fix the router endpoint**

In `engine_router.py`, replace the inline broadcast with `broadcast_changes` + `_log_to_audit`:

```python
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
```

**Step 4: Run tests**

Run: `cd apps/tfc/backend && .venv/bin/python -m pytest -x`
Expected: all pass

**Step 5: Commit**

```
fix(tfc): route recommendation through broadcast_changes + audit

Recommendation was the only decision-related mutation bypassing the
canonical broadcast and audit paths. Now uses broadcast_changes()
and _log_to_audit() like close_decision.
```

---

### Task 2: Consolidate session lifecycle into ExerciseSessionService

Currently: `start_engine` creates engine + wires callbacks + broadcasts participants (router-owned). `complete_engine` just completes and broadcasts (router-owned). `stop_engine` delegates to `ExerciseSessionService.stop()`. Three different shapes.

Fix: Add `ExerciseSessionService.complete()` that does complete + broadcast + audit without teardown. Keep `stop()` as full teardown. `start` stays in the router because it has DI dependencies (`ExerciseService`, `ScenarioService`) that don't belong in the session service.

**Files:**
- Modify: `apps/tfc/backend/features/exercise/exercise_session_service.py`
- Modify: `apps/tfc/backend/features/exercise/engine_router.py:188-197`
- Test: `apps/tfc/backend/features/exercise/exercise_session_service_test.py`

**Step 1: Write the failing test**

File: `apps/tfc/backend/features/exercise/exercise_session_service_test.py` (append to `TestStopEngineEndpoint`)

```python
async def test_complete_broadcasts_and_keeps_engine(self, client: AsyncClient) -> None:
    """Complete should broadcast phase_change but NOT remove engine or close WS."""
    eid = await self._create_exercise_with_scenario(client)
    await client.post(f"/api/exercises/{eid}/engine/start")
    engine = session_store.get(eid)
    assert engine is not None
    await engine.begin()

    resp = await client.post(f"/api/exercises/{eid}/engine/complete")
    assert resp.status_code == 200
    assert resp.json()["phase"] == "completed"

    # Engine stays alive (for completion overlay)
    engine_after = session_store.get(eid)
    assert engine_after is not None
    assert engine_after.phase.value == "completed"
```

**Step 2: Run test — should pass (existing behavior already works this way)**

Run: `cd apps/tfc/backend && .venv/bin/python -m pytest -xvs features/exercise/exercise_session_service_test.py::TestStopEngineEndpoint::test_complete_broadcasts_and_keeps_engine`

**Step 3: Add `complete()` method to ExerciseSessionService**

```python
async def complete(
    self,
    exercise_id: int,
    broadcast_fn: Callable | None = None,
    audit_fn: Callable | None = None,
) -> PhaseChange | None:
    """Complete the engine without teardown (for completion overlay).

    Unlike stop(), this keeps the engine alive and WS connections open
    so clients can render the completion overlay.
    """
    engine = self._sessions.get(exercise_id)
    if engine is None:
        return None
    try:
        result = await engine.complete()
    except EngineStateError:
        logger.warning(
            "Could not complete engine for exercise=%d (phase=%s)",
            exercise_id,
            engine.phase,
        )
        return None
    if broadcast_fn:
        await broadcast_fn([result])
    if audit_fn:
        await audit_fn(exercise_id, [result])
    return result
```

**Step 4: Update `complete_engine` router to use the service**

```python
@router.post("/complete", operation_id="completeEngine")
async def complete_engine(exercise_id: int) -> PhaseChange:
    svc = ExerciseSessionService(session_store, connection_manager, waiting_room_store)
    result = await svc.complete(
        exercise_id,
        broadcast_fn=lambda changes: broadcast_changes(connection_manager, exercise_id, changes),
        audit_fn=_log_to_audit,
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot complete")
    return result
```

**Step 5: Run all tests**

Run: `cd apps/tfc/backend && .venv/bin/python -m pytest -x`
Expected: all pass

**Step 6: Commit**

```
refactor(tfc): consolidate complete into ExerciseSessionService

ExerciseSessionService now owns both complete() (keeps engine alive
for overlay) and stop() (full teardown). Router delegates to service
for both paths. Start remains router-owned due to DI dependencies.
```

---

### Task 3: Unify frontend completion handling

Two paths detect completion: `exercise_stopped` with `reason=completed` and `phase_change(completed)` in `state_changes`. Both do `store.applyPhaseChange("completed")` + `ws.disconnect()`. Extract to one helper.

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/player/player-ws-handler.ts`
- Test: `apps/tfc/frontend/src/app/features/player/player-ws-handler.spec.ts` (create)

**Step 1: Write the test**

File: `apps/tfc/frontend/src/app/features/player/player-ws-handler.spec.ts`

```typescript
import { handlePlayerWsMessage } from './player-ws-handler';

describe('handlePlayerWsMessage', () => {
  const mockStore = {
    applyPhaseChange: jest.fn(),
    applySnapshot: jest.fn(),
    // ... other store methods
  } as any;

  const mockWs = { disconnect: jest.fn() } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should set phase and disconnect on exercise_stopped reason=completed', () => {
    handlePlayerWsMessage(
      { type: 'exercise_stopped', reason: 'completed' } as any,
      mockStore, undefined, mockWs,
    );
    expect(mockStore.applyPhaseChange).toHaveBeenCalledWith('completed');
    expect(mockWs.disconnect).toHaveBeenCalled();
  });

  it('should set phase and disconnect on phase_change completed in state_changes', () => {
    handlePlayerWsMessage(
      { type: 'state_changes', changes: [{ type: 'phase_change', phase: 'completed', action: 'completed', time: {} }] } as any,
      mockStore, undefined, mockWs,
    );
    expect(mockStore.applyPhaseChange).toHaveBeenCalledWith('completed');
    expect(mockWs.disconnect).toHaveBeenCalled();
  });

  it('should navigate away on exercise_stopped reason=stopped_by_gm', () => {
    const onStopped = jest.fn();
    handlePlayerWsMessage(
      { type: 'exercise_stopped', reason: 'stopped_by_gm' } as any,
      mockStore, onStopped, mockWs,
    );
    expect(onStopped).toHaveBeenCalled();
    expect(mockStore.applyPhaseChange).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test**

Run: `cd apps/tfc/frontend && npx jest --testPathPattern=player-ws-handler.spec`

**Step 3: Extract `handleCompletion` helper**

```typescript
/** Canonical completion handler — used by all paths that detect exercise completion. */
function handleCompletion(store: StoreInstance, ws?: ExerciseWsService): void {
  store.applyPhaseChange("completed");
  ws?.disconnect();
}

export function handlePlayerWsMessage(
  msg: WsMessage,
  store: StoreInstance,
  onStopped?: () => void,
  ws?: ExerciseWsService,
): void {
  switch (msg.type) {
    case "exercise_stopped":
      if (msg.reason === "completed") {
        handleCompletion(store, ws);
      } else {
        onStopped?.();
      }
      break;
    case "snapshot":
      store.applySnapshot(msg);
      break;
    case "state_changes":
      for (const change of msg.changes) {
        handleStateChange(change, store);
        if (change.type === "phase_change" && change.phase === "completed") {
          handleCompletion(store, ws);
        }
      }
      break;
  }
}
```

**Step 4: Run frontend tests**

Run: `cd apps/tfc/frontend && npx jest --testPathPattern=player-ws-handler.spec`
Expected: all pass

**Step 5: Commit**

```
refactor(tfc): extract handleCompletion for unified frontend completion path

Two WS paths detected completion independently (exercise_stopped with
reason=completed, and phase_change(completed) in state_changes). Both
now call a single handleCompletion() helper. Added player-ws-handler
spec file with tests for all three message paths.
```
