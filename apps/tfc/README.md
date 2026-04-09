# TFC — Training Flow Control

A real-time exercise simulation platform. A Game Master loads a scenario, starts the exercise, and players respond to injects, defects, and decision points as they unfold.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 21 — zoneless, signals, standalone components (port 4201) |
| Backend | FastAPI — Python 3.12+, async, Pydantic v2 (port 8001) |
| Database | PostgreSQL 17 — SQLAlchemy 2.0 (async), Alembic migrations (port 5433, separate from main) |
| Auth | None (disabled — anonymous access) |
| Real-time | WebSocket — engine state broadcast + client commands |
| Design System | `@aspect/design-system` + `@aspect/ui` (shared with main app) |

## Quick Start

```bash
# Full Docker stack (db + tfc-api)
make dev-tfc

# Best DX: DB + TFC API in Docker, Angular natively (instant HMR)
make dev-tfc-local

# Run TFC tests
make test-tfc-backend
make test-tfc-frontend

# Run database migrations
make migrate-tfc
```

## Project Structure

```
apps/tfc/
├── CLAUDE.md                         # Claude Code entry point
├── AGENTS.md                         # LLM agent instructions
├── README.md                         # This file
│
├── backend/
│   ├── core/                         # Config, database, auth, middleware, DI
│   ├── engine/                       # Pure-Python exercise runtime
│   │   ├── time_manager.py           #   Wall-clock → play-time with speed factor
│   │   ├── inject_scheduler.py       #   Trigger injects by play-time offset
│   │   ├── defect_manager.py         #   Defect lifecycle (dormant → active → resolved)
│   │   ├── decision_manager.py       #   Decision point tracking
│   │   ├── exercise_engine.py        #   Orchestrator (250ms tick loop)
│   │   └── session_store.py          #   In-memory engine instance registry
│   ├── features/
│   │   ├── audit/                    #   Audit trail
│   │   ├── decision/                 #   Decision CRUD
│   │   ├── exercise/                 #   Exercise lifecycle + engine API + WebSocket
│   │   ├── health/                   #   Health check
│   │   └── scenario/                 #   Scenario CRUD + content loader
│   └── main.py                       # App factory with auto-discovery
│
├── frontend/
│   └── src/app/
│       ├── core/                     # Environment config
│       ├── shared/                   # TFC shared components, services, store
│       │   ├── components/           #   Clock, context panel, decision panel, phase badge
│       │   ├── *.service.ts          #   Engine API, WebSocket, scenario, audit, decision
│       │   └── exercise.store.ts     #   Central NgRx Signal Store
│       └── features/
│           ├── game-master/          #   GM view (engine controls, timeline, defect mgmt)
│           ├── player/               #   Player view (injects, decisions)
│           ├── join/                 #   Exercise join / lobby
│           ├── review/               #   Post-exercise review
│           └── scenario-builder/     #   Scenario creation UI
```

## How It Works

1. **Scenario** — A reusable template containing a briefing, objectives, timed injects, defects, and decision templates.
2. **Exercise** — A running instance of a scenario. The GM creates an exercise, players join, and the GM starts the clock.
3. **Engine** — A pure-Python tick loop (250ms) that advances play time, triggers injects, surfaces defects, and pauses for decision points. State changes are broadcast to all connected clients via WebSocket.
4. **Game Master** — Controls the exercise: start, pause, resume, complete, adjust speed. Sees the full timeline and can inject ad-hoc injects.
5. **Player** — Sees injects and defects as they fire, responds to decision points, and reviews outcomes after the exercise.

### Engine Phases

```
setup ──▶ running ──▶ paused ──▶ completed
              │           │
              └───────────┘  (resume)
```

Decision events automatically pause the engine until the GM or players resolve them.

### Key Concepts

- **Play time vs real time**: The engine supports a configurable speed factor (e.g., 2× means 2 minutes of simulated time per 1 real minute).
- **Injects**: Scheduled occurrences (`NARRATIVE`, `DECISION`, `INJECT`) with lifecycle `pending → active → completed`.
- **Defects**: Problems triggered by injects, with lifecycle `dormant → active → mitigated → resolved`.
- **Decisions**: Questions posed to players when a `DECISION` inject fires. The engine pauses until resolved.

## Development

### Adding a Backend Feature

TFC follows the same feature-sliced pattern as the main app. Each feature is a flat folder under `features/` with model, schema, repository, service, router, and test files. Routers are auto-discovered by `main.py`.

### Engine Development

The `engine/` directory is intentionally isolated — no database, no HTTP, no FastAPI imports. This makes it fast to test:

```bash
cd apps/tfc/backend
python -m pytest engine/ -v
```

Core engine components:
- `InjectScheduler`: Manages timed injects and triggers them based on play-time offsets
- `DefectManager`: Tracks defect lifecycle and state transitions
- `TimeManager`: Converts real time to play time using configurable speed factors
- `DecisionManager`: Manages decision points and player responses
- `ExerciseEngine`: Main orchestrator (250ms tick loop)

### Frontend Development

TFC frontend uses the same Angular 21 patterns as the main app (signals, standalone components, OnPush, NgRx Signal Store). TFC-specific shared components live in `src/app/shared/`, not in `packages/ui/`.

## License

MIT
