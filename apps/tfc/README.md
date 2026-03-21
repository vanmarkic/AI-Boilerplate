# TFC — Training Flow Control

A real-time exercise simulation platform. A Game Master loads a scenario, starts the exercise, and players respond to events, issues, and decision points as they unfold.

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
│   │   ├── engine_config.py          #   DecisionTemplate, EngineConfig dataclasses
│   │   ├── time_manager.py           #   Wall-clock → play-time with speed factor
│   │   ├── event_scheduler.py        #   Trigger events by play-time offset
│   │   ├── issue_manager.py          #   Issue lifecycle (dormant → active → resolved)
│   │   ├── decision_manager.py       #   Decision point tracking
│   │   ├── exercise_engine.py        #   Orchestrator (250ms tick loop)
│   │   ├── session_store.py          #   In-memory engine instance registry
│   │   ├── state_changes.py          #   State change event types
│   │   ├── strategies.py             #   Hypothesis data generators for property tests
│   │   └── game_modes/               #   Pluggable game mode strategies
│   │       ├── classic.py            #     ClassicMode — GM-driven, no scoring
│   │       └── simple_collaborative.py #   SimpleCollaborativeMode — advisor/decision-maker roles
│   ├── features/
│   │   ├── audit/                    #   Audit trail
│   │   ├── decision/                 #   Decision CRUD
│   │   ├── domain_config/            #   DB-backed domain terminology dictionary
│   │   ├── exercise/                 #   Exercise lifecycle + engine API + WebSocket
│   │   ├── health/                   #   Health check
│   │   ├── scenario/                 #   Scenario CRUD + content loader
│   │   └── waiting_room/             #   Pre-exercise lobby (presence, ready-up)
│   └── main.py                       # App factory with auto-discovery
│
├── codegen/
│   ├── generate-types.py             # Python TypedDicts → TypeScript interfaces
│   └── check-freshness.sh            # CI: fail if generated types are stale
│
├── frontend/
│   └── src/app/
│       ├── core/                     # Services, store, environment config
│       │   └── generated/            #   Codegen output (DO NOT EDIT)
│       ├── shared/                   # TFC shared components, services, store
│       │   ├── components/           #   Clock, context panel, decision panel, phase badge,
│       │   │                         #   advisor bubbles, ambient background, domain selector,
│       │   │                         #   presence indicator, score bar, turn banner
│       │   ├── components-animations.css   # GSAP animation classes
│       │   ├── components-decision.css     # Decision panel styles
│       │   ├── components-exercise-layout.css  # Exercise layout primitives
│       │   ├── *.service.ts          #   Engine API, WebSocket, scenario, audit, decision
│       │   └── exercise.store.ts     #   Central NgRx Signal Store
│       └── features/
│           ├── game-master/          #   GM view (engine controls, timeline, issue mgmt)
│           ├── player/               #   Player view (events, decisions)
│           ├── join/                 #   Exercise join / lobby
│           ├── review/               #   Post-exercise review
│           ├── scenario-builder/     #   Scenario creation UI
│           └── waiting-room/         #   Pre-exercise lobby (presence, ready-up)
```

## How It Works

See `SPECS.md` for the complete domain model, business rules, game modes, scoring, stress model, and API surface. Quick summary:

1. **Scenario** → **Exercise** → **Engine** (250ms tick loop) → **WebSocket** → all clients
2. Engine phases: `setup → briefing → running → paused → completed`
3. Game modes: Classic (GM-driven) and Simple Collaborative (advisor/decision-maker, scored)
4. Players join via 6-character session codes; roles assigned in waiting room

## Development

### Adding a Backend Feature

TFC follows the same feature-sliced pattern as the main app. Each feature is a flat folder under `features/` with model, schema, repository, service, router, and test files. Routers are auto-discovered by `main.py`.

### Engine Development

The `engine/` directory is intentionally isolated — no database, no HTTP, no FastAPI imports. This makes it fast to test:

```bash
cd apps/tfc/backend
python -m pytest engine/ -v
```

### Type Codegen

Backend Python TypedDicts in `engine/state_changes.py` are the single source of truth for engine state types. A codegen script generates the TypeScript equivalents:

```bash
cd apps/tfc/frontend
npm run generate:types    # Regenerate core/generated/state-changes.types.ts
```

Run this after modifying any TypedDict in `state_changes.py`. The CI freshness check (`codegen/check-freshness.sh`) will fail if the generated file is stale.

### Frontend Development

TFC frontend uses the same Angular 21 patterns as the main app (signals, standalone components, OnPush, NgRx Signal Store). TFC-specific shared components live in `src/app/shared/`, not in `packages/ui/`.

## License

MIT
