# Stop Exercise & Flush Resources — Design

**Date:** 2026-03-19
**Status:** Approved

## Problem

When an exercise completes or needs to be force-stopped, three in-memory singletons accumulate orphaned state:

| Resource | Store | Has cleanup? |
|----------|-------|-------------|
| Engine (tick loop, timeout monitor) | `session_store._sessions` | `remove()` exists, never called in prod |
| WebSocket connections | `connection_manager._connections` | Per-client disconnect only, no bulk close |
| Waiting room participants | `waiting_room_store._rooms` | `clear()` exists, never called in prod |

This causes memory leaks on long-running servers and leaves no way for users to fully end an exercise.

## Design Decisions

1. **Two triggers:** GM force-stop (`POST /engine/stop`) + automatic cleanup on natural completion (`POST /engine/complete`)
2. **Clean architecture:** New `ExerciseSessionService` orchestrates cleanup across the three singletons (application use-case layer)
3. **WS notification:** Server sends `exercise_stopped` message before closing connections — clients navigate to home
4. **Server-authoritative close:** New `ConnectionManager.close_all(exercise_id)` force-closes all WebSockets for an exercise

## Cleanup Sequence

```
POST /engine/stop (or /engine/complete)
  │
  ▼
ExerciseSessionService.stop(exercise_id)
  │
  ├── 1. engine.complete()          # stop tick loop, timeout monitor
  ├── 2. broadcast("exercise_stopped")  # notify all WS clients
  ├── 3. connection_manager.close_all() # server-close all WebSockets
  ├── 4. waiting_room_store.clear()     # flush waiting room
  └── 5. session_store.remove()         # free engine from memory
```

## Backend Changes

### 1. `ConnectionManager.close_all(exercise_id)`

New method on `features/exercise/adapters/connection_manager.py`:
- Iterates all connections for the exercise
- Calls `websocket.close()` on each
- Removes the exercise key from `_connections`

### 2. `ExerciseSessionService`

New file: `features/exercise/exercise_session_service.py`

```python
class ExerciseSessionService:
    def __init__(self, session_store, connection_manager, waiting_room_store):
        ...

    async def stop(self, exercise_id: int) -> None:
        # 1. Complete engine if not already completed
        # 2. Broadcast exercise_stopped
        # 3. Close all WS connections
        # 4. Clear waiting room
        # 5. Remove engine from session store
```

### 3. Endpoint Changes

- **New `POST /engine/stop`** — calls `ExerciseSessionService.stop()`, returns `{"stopped": true}`
- **Existing `POST /engine/complete`** — after `engine.complete()`, also calls cleanup via the service

### 4. `exercise_stopped` WS message shape

```json
{
  "type": "exercise_stopped",
  "exercise_id": 123,
  "reason": "stopped_by_gm"
}
```

Reason values: `"stopped_by_gm"` (force-stop) or `"completed"` (natural completion).

## Frontend Changes

### 5. `EngineApiService.stop(exerciseId)`

New method mirroring existing lifecycle methods.

### 6. `ExerciseWsService`

No code changes needed — when the server closes the WebSocket, `onclose` fires. Since the `exercise_stopped` message arrives first, the WS handler will call `disconnect()` (setting `intentionalClose = true`) before the close event, preventing auto-reconnect.

### 7. WS Handlers

Both `player-ws-handler.ts` and `gm-ws-handler.ts`:
- Handle `exercise_stopped` message type
- Call `router.navigate(['/'])` to go home

### 8. UI — Stop Button

**GM view:** Add a "Stop" button (variant=destructive) next to existing controls. Visible when phase is not `setup`.

**Player view (practice mode):** Add a "Stop" button in the footer. Only visible in practice mode since the player is also the GM.

## Files Modified

| File | Change |
|------|--------|
| `backend/features/exercise/adapters/connection_manager.py` | Add `close_all()` |
| `backend/features/exercise/exercise_session_service.py` | **New file** |
| `backend/features/exercise/engine_router.py` | Add `/stop`, wire cleanup into `/complete` |
| `frontend/src/app/core/engine-api.service.ts` | Add `stop()` |
| `frontend/src/app/core/exercise-ws.service.ts` | Add `exercise_stopped` to WsMessage type |
| `frontend/src/app/features/player/player-ws-handler.ts` | Handle `exercise_stopped` |
| `frontend/src/app/features/game-master/gm-ws-handler.ts` | Handle `exercise_stopped` |
| `frontend/src/app/features/player/player-view.ts` | Stop button (practice mode) |
| `frontend/src/app/features/player/player-view.html` | Stop button template |
| `frontend/src/app/features/game-master/game-master-view.ts` | Stop button + handler |
| `frontend/src/app/features/game-master/gm-engine-actions.ts` | Add `stopExercise()` |

## Testing

- Unit test `ExerciseSessionService.stop()` with mocked singletons
- Unit test `ConnectionManager.close_all()`
- Router test for `POST /engine/stop`
- Verify `/engine/complete` also triggers cleanup
