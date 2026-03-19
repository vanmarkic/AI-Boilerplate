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

1. **Scenario** — A reusable template containing a briefing, objectives, timed events, issues, and decision templates.
2. **Exercise** — A running instance of a scenario. The GM creates an exercise, players join, and the GM starts the clock.
3. **Engine** — A pure-Python tick loop (250ms) that advances play time, triggers events, surfaces issues, and pauses for decision points. State changes are broadcast to all connected clients via WebSocket.
4. **Game Master** — Controls the exercise: start, pause, resume, complete, adjust speed. Sees the full timeline and can inject ad-hoc events.
5. **Player** — Sees events and issues as they fire, responds to decision points, and reviews outcomes after the exercise.

### Engine Phases

```
setup ──▶ running ──▶ paused ──▶ completed
              │           │
              └───────────┘  (resume)
```

Decision events automatically pause the engine until the GM or players resolve them.

### Key Concepts

- **Play time vs real time**: The engine supports a configurable speed factor (e.g., 2× means 2 minutes of simulated time per 1 real minute).
- **Events**: Scheduled occurrences (`NARRATIVE`, `DECISION`, `INJECT`) with lifecycle `pending → active → completed`.
- **Issues**: Problems triggered by events, with lifecycle `dormant → active → mitigated → resolved`.
- **Decisions**: Questions posed to players when a `DECISION` event fires. The engine pauses until resolved.
- **Domain Config**: Terminology and labels are stored in the database via `features/domain_config/`, not hardcoded. This lets each scenario use its own vocabulary.
- **Three.js Sea Backdrop**: Ambient 3D ocean scene with glowing dot convergence effect, used as visual backdrop in the player view. Camera FOV set to 50mm full-frame equivalent (27°).
- **Scenario Validation**: Scenario JSON is validated at Docker build time and seed time. The scenario builder UI also validates content before saving.

### Game Modes

Game modes are pluggable strategies in `engine/game_modes/` that change how decisions, scoring, and roles work:

| Mode | Description |
|------|-------------|
| `ClassicMode` | GM-driven. No scoring. Engine pauses on DECISION events for GM to resolve. |
| `SimpleCollaborativeMode` | No GM required. Advisors submit recommendations; decision-maker makes the final call. Per-card +/0/- scoring. Forced card enforcement. Decisions chain sequentially. Wrong answers shrink time for subsequent decisions. Supports 2-player variant. |

To add a new mode, create a class in `engine/game_modes/` implementing `should_pause_on_decision()` and any scoring hooks, then wire it into `EngineConfig`.

### Scoring (SimpleCollaborativeMode)

- Each card (decision option) has a `score: float` — positive (good), zero (neutral), or negative (bad)
- Selected score = sum of selected card scores
- Max score = sum of top-N scores from all options (N = number selected)
- Penalty: `(max_score - selected_score) * penalty_factor * 1000` ms deducted from next decision timer
- Timer floor: effective time never drops below `min_decision_time_ms`
- **Forced cards**: `forced_option_ids` on a decision template. If omitted by player, auto-included with penalty + `ForcedCardApplied` state change

### Session Codes & Joining

Exercises use 6-character unique session codes for joining. Players enter a code on the join page or browse active lobbies on the home page. Role assignment happens in the waiting room before the exercise starts.

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
