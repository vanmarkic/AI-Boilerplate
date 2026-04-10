# TFC — Training Flow Control

## First Steps
Before writing any code:
1. Read the root `AGENTS.md` — all universal rules (strict types, feature manifests, `make validate`) apply here.
2. Read `backend/AGENTS.md` (coming from `apps/main/backend/AGENTS.md` conventions) and `frontend/AGENTS.md` (from `apps/main/frontend/AGENTS.md` conventions) for layer-specific rules — TFC follows the same patterns.

## What TFC Is
TFC is a domain-agnostic exercise simulation platform. A Game Master (GM) loads a scenario, starts the exercise, and players respond to injects, defects, and decision points in real time. Think crisis-management tabletop exercise, but digital and real-time.

## Domain Model

```
Scenario  ──loads──▶  Exercise  ──runs──▶  Engine
                         │                    │
                         │               ┌────┴─────┐
                      Participants    TimeManager
                      (GM + Players)  InjectScheduler
                                      DefectManager
                                      DecisionManager
```

- **Scenario**: a reusable template (title, briefing, objectives, events, issues, decision templates).
- **Exercise**: a running instance of a scenario with participants.
- **Engine** (`engine/`): the tick-based runtime that advances time, triggers events, surfaces issues, and pauses for decisions.

## Stack (same as root, with TFC-specific additions)
- Backend: FastAPI (`apps/tfc/backend/`), port 8001
- Frontend: Angular 21 (`apps/tfc/frontend/`), port 4201
- Real-time: WebSocket (`features/exercise/ws_router.py`)
- Engine: pure-Python tick loop (250ms), no external dependencies

## Architecture

### Backend (`apps/tfc/backend/`)
```
core/           # config, database, auth, middleware, DI (same pattern as main app)
engine/         # pure-Python exercise runtime (no DB, no HTTP)
  time_manager.py
  inject_scheduler.py
  defect_manager.py
  decision_manager.py
  exercise_engine.py
  session_store.py
  state_changes.py
features/
  audit/        # audit trail (all exercise injects logged)
  decision/     # decision CRUD (questions, responses, outcomes)
  exercise/     # exercise lifecycle + engine HTTP API + WebSocket
  health/       # health check
  scenario/     # scenario CRUD + scenario content loader
```

Key architectural distinction: the `engine/` directory is **not** a feature — it is a pure runtime with no database or HTTP dependencies. Features in `features/exercise/` wrap the engine with HTTP/WS endpoints and persistence.

### Frontend (`apps/tfc/frontend/`)
```
src/app/
  core/           # environment config
  shared/         # TFC-specific shared components + services
    components/   # clock-display, context-panel, decision-panel, phase-badge, speed-display
    *.service.ts  # engine-api, exercise-ws, scenario-api, audit-api, decision-api
    exercise.store.ts  # central NgRx Signal Store for exercise state
    format-time.ts
  features/
    game-master/  # GM view (engine controls, inject timeline, defect management)
    player/       # Player view (injects, decisions, read-only timeline)
    join/         # Exercise join/lobby
    review/       # Post-exercise review
    scenario-builder/  # Scenario creation UI
```


## Engine Concepts
- **Tick loop**: 250ms interval. Each tick advances play time, checks inject triggers, transitions defect lifecycles, and broadcasts state changes via WebSocket.
- **Play time vs real time**: `TimeManager` supports a speed factor (e.g., 2× = 2 minutes of play time per 1 real minute).
- **Engine phases**: `setup → running → paused → completed`. Decision injects auto-pause the engine.
- **Injects**: scheduled occurrences with lifecycle `pending → active → completed`. Types: `NARRATIVE`, `DECISION`, `INJECT`.
- **Defects**: problems surfaced by injects, with lifecycle `dormant → active → mitigated → resolved`. Can auto-resolve after a countdown.
- **Decisions**: questions posed to players when a DECISION inject fires. Engine pauses until resolved.

## Development Commands

```bash
make dev-tfc              # Full TFC Docker stack (db + tfc-api)
make dev-tfc-local        # DB + TFC API in Docker, Angular natively (instant HMR)
make dev-tfc-frontend     # TFC Angular only (expects backend running)
make dev-tfc-backend      # TFC backend + db (Docker)
make test-tfc-backend     # Run TFC backend tests
make test-tfc-frontend    # Run TFC frontend tests
make test-all             # Run ALL tests (main + TFC)
make migrate-tfc          # Run TFC database migrations
```

## Rules (in addition to root AGENTS.md)
1. The `engine/` directory must remain pure Python — no SQLAlchemy, no FastAPI, no HTTP imports. Test it in isolation.
2. All real-time communication goes through the WebSocket in `features/exercise/ws_router.py`. Do NOT add additional WebSocket endpoints.
3. TFC frontend components use the same `@aspect/design-system` tokens and `@aspect/ui` components as the main app. TFC-specific component styles go in `shared/components-*.css` files.
4. The exercise store (`shared/exercise.store.ts`) is the single source of truth for frontend exercise state. Features read from it, never from raw WebSocket messages.
5. Scenario content (briefing, injects, defects, decision templates) is loaded by `scenario_loader.py` and passed to the engine as an `EngineConfig`. Do NOT hardcode scenario data in the engine.

## Common Pitfalls
- Do NOT import `sqlalchemy`, `fastapi`, or `httpx` inside `engine/` — it must stay pure.
- Do NOT create a second WebSocket endpoint — extend `ws_router.py` if needed.
- Do NOT put exercise-specific UI components in `packages/ui/` — they belong in `apps/tfc/frontend/src/app/shared/`.
- Do NOT mutate engine state from outside the tick loop — use engine methods (`start`, `pause`, `complete`, `reset`, `set_speed`).
- Do NOT skip `make test-tfc-backend` before committing engine changes — the engine has dedicated unit tests.
