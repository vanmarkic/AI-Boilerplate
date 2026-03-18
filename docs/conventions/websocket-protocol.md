# WebSocket Protocol — TFC Exercise Real-Time Updates

## Connection

**Endpoint:** `ws://<host>/api/exercises/{exercise_id}/ws?role={gm|player}[&participant_id={id}]`

The server accepts the connection, registers it in `ConnectionManager` (grouped by exercise ID and role), broadcasts a presence update to GMs, and immediately sends a `snapshot` message so the client can sync full state.

**Source files:**
- Backend: `apps/tfc/backend/features/exercise/ws_router.py`
- Frontend: `apps/tfc/frontend/src/app/core/exercise-ws.service.ts`
- Connection manager: `apps/tfc/backend/features/exercise/adapters/connection_manager.py`

## Server-to-Client Message Types

All messages are JSON with a top-level `type` field.

| `type` | When sent | Payload shape |
|--------|-----------|---------------|
| `snapshot` | On connect (initial sync) | Full engine state: `exercise_id`, `title`, `phase`, `time`, `events`, `issues`, `decisions`, `score` |
| `state_changes` | On engine tick or engine action | `{ type: "state_changes", changes: StateChange[] }` |
| `waiting_room_update` | On waiting-room join/leave/ready | Lobby participant list |
| `pong` | In response to client `ping` | `{ type: "pong" }` |

## Client-to-Server Message Types

| `type` | Purpose |
|--------|---------|
| `ping` | Keep-alive heartbeat (client sends every 15 s) |

The server responds with `pong`. No other client-to-server messages are defined on the WebSocket; all commands (start, pause, speed change, decisions) go through HTTP endpoints that trigger engine actions and broadcast results.

## State Change Types

Each entry in the `changes` array has a `type` field. Defined in `apps/tfc/backend/engine/state_changes.py`:

| `type` | Key fields | Triggers |
|--------|-----------|----------|
| `phase_change` | `action` (started/paused/completed/reset), `phase`, `time` | UI phase badge + clock update |
| `event_change` | `event_id`, `action` (activated/started/completed/force_triggered/cancelled), `lifecycle`, `title` | Store `updateEvent` |
| `issue_change` | `issue_id`, `action` (activated/mitigated/resolved/auto_resolve_expired), `lifecycle`, `title`, `released` | Store `updateIssue` |
| `decision_opened` | `decision_id`, `title`, `question_type`, `options`, `target_roles`, `timeout_ms` | Store `applyDecisions` (appends) |
| `decision_closed` | `decision_id`, `title`, `selected_option_ids` | Store `closeDecision` |
| `speed_change` | `factor` | Clock display update |
| `score_change` | `total_score`, `penalty_ms`, `next_decision_time_ms`, `turn_number` | Store `applyScoreChange` |
| `recommendation_submitted` | `decision_id`, `participant_id`, `option_id` | Store `applyRecommendation` |
| `forced_card_applied` | `decision_id`, `forced_option_id`, `reason` | Decision panel notification |
| `presence_update` | `participants[]` (id, display_name, role, connected) | Store `updatePresence` (GM only) |

## Role-Targeted Broadcasting

`decision_opened` changes with `target_roles` are sent only to matching roles plus always to GMs. All other changes broadcast to every connected client. See `engine_broadcast.py` for the splitting logic.

## Data Flow

```
Engine tick (250 ms)
  -> exercise_engine.tick() returns list[StateChange]
  -> engine_router calls broadcast_changes(connection_manager, exercise_id, changes)
    -> split_targeted_changes: separates role-targeted decisions from general
    -> connection_manager.broadcast / broadcast_to_role
      -> JSON over WebSocket
  -> Frontend ExerciseWsService.messages$ emits WsMessage
  -> gm-ws-handler.ts / player-ws-handler.ts dispatches to ExerciseStore methods
  -> Angular signals recompute; UI updates
```

## Reconnection Strategy

Defined in `exercise-ws.service.ts` as `RECONNECT_DELAYS`:

| Attempt | Delay |
|---------|-------|
| 1 | 1 s |
| 2 | 2 s |
| 3 | 4 s |
| 4 | 8 s |
| 5+ | 16 s (cap) |

On each reconnection the client opens a fresh WebSocket with the same parameters. The server sends a new `snapshot` so the client re-syncs any missed state. The attempt counter resets to 0 on successful open.

Intentional disconnects (`disconnect()`) skip reconnection.

## Ping / Keep-Alive

- **Interval:** 15 s (`PING_INTERVAL` in `exercise-ws.service.ts`)
- **Client sends:** `{ "type": "ping" }`
- **Server replies:** `{ "type": "pong" }`
- Ping starts on `onopen`, stops on `onclose` or intentional disconnect.

## Persistence vs UI-Only Updates

State changes are **not persisted by the WebSocket layer**. The engine is an in-memory runtime. Persistence happens separately through the `audit` feature (audit trail) and `exercise` feature (exercise lifecycle endpoints). The WebSocket is purely a broadcast channel for real-time UI updates.

The `snapshot` message on connect is the recovery mechanism: if a client disconnects and reconnects, it receives full current state regardless of missed intermediate changes.

## Snapshot on Connect

When a client connects:
1. Server calls `engine.snapshot()` to get full current state.
2. Sends `{ type: "snapshot", ...snapshot }` with all fields (`exercise_id`, `title`, `phase`, `time`, `events`, `issues`, `decisions`, `score`).
3. Frontend calls `store.applySnapshot()` to replace local state entirely.

This ensures clients that join mid-exercise or reconnect after a drop always have correct state.
