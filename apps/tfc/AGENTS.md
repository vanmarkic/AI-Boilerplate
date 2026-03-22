# TFC — Training Flow Control

## First Steps
Before writing any code:
1. Read the root `AGENTS.md` — all universal rules (350-line limit, strict types, no barrel exports, feature manifests, `make validate`) apply here.
2. Read `apps/main/backend/AGENTS.md` for backend conventions (FastAPI patterns, testing, SQL) and `apps/main/frontend/AGENTS.md` for frontend conventions (Angular patterns, signals, stores) — TFC follows the same stack patterns.
3. Read `apps/tfc/SPECS.md` — it is the **single source of truth** for TFC domain model, business rules, API surface, game modes, scoring, systems, backlog, and glossary. It must be kept up to date with every feature or business-rule change. If a feature's `manifest.yaml` exists, read it for feature-specific context.

## What TFC Is
TFC is a domain-agnostic exercise simulation platform. A Game Master (GM) loads a scenario, starts the exercise, and players respond to events, issues, and decision points in real time. Think crisis-management tabletop exercise, but digital and real-time.

## Terminology Mapping (Domain ↔ Code)

The exercise simulation domain uses specific terms. The codebase uses generic equivalents.
**When the user says one, find the other.**

| User/Domain says | Code uses | Key files |
|-----------------|-----------|-----------|
| **inject** | `Event`, `ScheduledEvent`, `EventScheduler` | `engine/event_scheduler.py`, `types/event.ts` |
| **defect** | `Issue`, `TrackedIssue`, `IssueManager` | `engine/issue_manager.py`, `types/issue.ts` |
| inject type | `EventType`, `event_type` | `engine/event_scheduler.py` |
| defect lifecycle | `IssueLifecycle`, `issue.lifecycle` | `engine/issue_manager.py` |
| inject timeline | `EventTimelineComponent` | `features/game-master/event-timeline.component.ts` |
| triggered defects | `triggered_issues` | field on `ScheduledEvent` / `ExerciseEvent` |
| defect trigger | `trigger_mode`, `trigger_event_id` | `TrackedIssue` fields |
| inject scheduler | `EventScheduler` | `engine/event_scheduler.py` |
| role-targeted inject | Event with `target_roles` + `role_descriptions` | `engine/event_scheduler.py`, `engine/state_changes.py` |
| defect manager | `IssueManager` | `engine/issue_manager.py` |
| inject snapshot | `EventSnapshot` | `engine-api.service.ts` |
| defect snapshot | `IssueSnapshot` | `engine-api.service.ts` |

### Silent Wake Scenario Reference

See `docs/SILENT-WAKE-GAME-MECHANICS.md` for the full Silent Wake domain reference (roles, systems, weapons, stress, turn structure, blue card catalog, abbreviations).

## Domain Model

See `SPECS.md` § Domain Model for entity relationships and the full domain diagram.

## Stack (same as root, with TFC-specific additions)
- Backend: FastAPI (`apps/tfc/backend/`), port 8001
- Frontend: Angular 21 (`apps/tfc/frontend/`), port 4201
- Real-time: WebSocket (`features/exercise/ws_router.py`) — see [WebSocket protocol docs](../../docs/conventions/websocket-protocol.md)
- Engine: pure-Python tick loop (250ms), no external dependencies

## Architecture

### Backend (`apps/tfc/backend/`)
```
core/           # config, database, auth, middleware, DI (same pattern as main app)
engine/         # pure-Python exercise runtime (no DB, no HTTP)
  engine_config.py      # DecisionTemplate, ScenarioContext, EngineConfig dataclasses
  time_manager.py
  event_scheduler.py
  issue_manager.py
  decision_manager.py
  exercise_engine.py
  session_store.py
  state_changes.py
  strategies.py         # Hypothesis strategies for property tests (*_prop_test.py)
  game_modes/           # pluggable game mode strategies
    classic.py          #   ClassicMode — GM-driven, no scoring
    simple_collaborative.py  # SimpleCollaborativeMode — advisor/decision-maker roles, per-card +/0/- scoring, forced cards, 2-player variant
features/
  audit/        # audit trail (all exercise events logged)
  decision/     # decision CRUD (questions, responses, outcomes)
  domain_config/ # DB-backed domain terminology dictionary (replaces hardcoded constants)
  exercise/     # exercise lifecycle + engine HTTP API + WebSocket
  health/       # health check
  scenario/     # scenario CRUD + scenario content loader
  waiting_room/ # pre-exercise lobby state (WebSocket presence, ready-up)
```

Key architectural distinction: the `engine/` directory is **not** a feature — it is a pure runtime with no database or HTTP dependencies. Features in `features/exercise/` wrap the engine with HTTP/WS endpoints and persistence.

### Codegen (`apps/tfc/codegen/`)
```
generate-types.py    # Reads Python TypedDicts → emits TypeScript interfaces
check-freshness.sh   # CI check: fail if generated TS is stale vs Python source
```

Run `npm run generate:types` (from `apps/tfc/frontend/`) after changing `backend/engine/state_changes.py`. The generated output lands in `frontend/src/app/core/generated/state-changes.types.ts`. Do NOT hand-edit generated files.

### Frontend (`apps/tfc/frontend/`)
```
src/app/
  core/           # services, store, environment config
    generated/    # codegen output (state-changes.types.ts) — DO NOT EDIT
    ws-state-handler.ts  # shared WS state-change → store logic
  shared/         # TFC-specific shared components + services
    components/   # clock-display, context-panel, decision-panel, phase-badge, speed-display,
                  # advisor-bubbles, ambient-background, domain-selector, presence-indicator,
                  # score-bar, turn-banner
    components-animations.css   # GSAP-driven animation classes
    components-decision.css     # decision panel styles
    components-exercise-layout.css  # exercise layout primitives
    *.service.ts  # engine-api, exercise-ws, scenario-api, audit-api, decision-api, domain
    logs-drawer.component.ts  # decision log drawer — uses store.decisions() + roles, not audit API
    exercise.store.ts  # central NgRx Signal Store for exercise state
    format-time.ts
  features/
    game-master/  # GM view (engine controls, event timeline, issue management)
    player/       # Player view (events, decisions, read-only timeline)
    join/         # Exercise join/lobby
    review/       # Post-exercise review
    scenario-builder/  # Scenario creation UI
    waiting-room/ # Pre-exercise lobby (presence indicators, ready-up)
```

## Engine Concepts

See `SPECS.md` for full business rules (features, game modes, stress model, decision timer, scoring, systems). Key implementation notes for agents:

- **Engine phases**: `setup → briefing → running → paused → completed`.
- **Tick loop**: 250ms interval — see `SPECS.md` § exercise feature for details.
- **Scenario validation**: JSON seed files are validated at Docker build time, seed time, and in the builder UI before saving.

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

## Error Handling
TFC uses the same `AppError` hierarchy as the main app (see `core/exceptions.py`). Services raise domain exceptions; the middleware in `core/middleware.py` translates them into JSON responses.

| Exception | Status | When to use |
|-----------|--------|-------------|
| `NotFoundError` | 404 | Resource lookup returns `None` |
| `ConflictError` | 409 | Duplicate or state conflict |
| `ForbiddenError` | 403 | Insufficient permissions |
| `BadRequestError` | 400 | Invalid input or business-rule violation |
| `EngineError` | 422 | Engine operation failed (invalid state transition, etc.) |

**Rules:**
- Services MUST raise `AppError` subclasses, NOT `fastapi.HTTPException`. This keeps business logic framework-agnostic.
- Routers may still use `HTTPException` for request-parsing edge cases, but prefer `AppError` subclasses.
- When migrating existing code, replace `HTTPException(status_code=404, ...)` with `NotFoundError(...)`, etc.
- Import from `core.exceptions`, not from `fastapi`.

## Rules (in addition to root AGENTS.md)
1. The `engine/` directory must remain pure Python — no SQLAlchemy, no FastAPI, no HTTP imports. Test it in isolation.
2. All real-time communication goes through the WebSocket in `features/exercise/ws_router.py`. Do NOT add additional WebSocket endpoints.
3. Domain-config types (`TerminologyMap`, `ThemeConfig`, `DomainRole`, `SeverityLevel`) live in `domain-config-api.service.ts`. Do NOT duplicate type definitions.
4. TFC frontend components use the same `@aspect/design-system` tokens and `@aspect/ui` components as the main app. TFC-specific component styles go in `shared/components-*.css` files.
5. The exercise store (`shared/exercise.store.ts`) is the single source of truth for frontend exercise state. Features read from it, never from raw WebSocket messages.
6. Scenario content (briefing, events, issues, decision templates) is loaded by `scenario_loader.py` and passed to the engine as an `EngineConfig`. Do NOT hardcode scenario data in the engine.
7. Game modes live in `engine/game_modes/`. Each mode is a dataclass implementing the `GameMode` strategy interface. Do NOT put mode-specific logic in `exercise_engine.py`.
8. Property tests use `engine/strategies.py` for Hypothesis data generators. When adding a new engine dataclass, add the corresponding Hypothesis strategy to `strategies.py` before writing property tests.
9. Domain terminology is stored in the DB via `features/domain_config/`. Do NOT hardcode domain-specific terms, labels, or dictionaries in the engine or frontend constants.

## Adding a New Game Mode

Follow this checklist in order when adding a new game mode to TFC.

### 1. Create the mode class: `engine/game_modes/<name>.py`

Create a new dataclass implementing all 7 methods of the `GameMode` protocol (`engine/game_modes/__init__.py`, lines 14-52):

- `should_pause_on_decision() -> bool` — whether the engine pauses when a decision opens
- `on_decision_timeout(decision_id, options) -> str | None` — option ID to auto-submit on timeout, or `None`
- `on_decision_closed_v2(decision_id, selected_options, all_options, forced_option_ids=None) -> list[dict]` — score from full option lists, enforce forced cards
- `snapshot() -> dict | None` — current scoring state for client sync
- `get_next_decision_id(closed_decision_id) -> str | None` — next decision template ID in sequence, or `None`
- `get_decision_time_ms(base_time_ms) -> int` — effective decision timer duration in ms
- `requires_gm() -> bool` — whether the mode requires a Game Master to drive

Use `ClassicMode` (`engine/game_modes/classic.py`) or `SimpleCollaborativeMode` (`engine/game_modes/simple_collaborative.py`) as reference implementations.

### 2. Wire into the mode factory: `engine/game_modes/__init__.py`

Add a new branch to `create_game_mode()` that matches the mode name string and instantiates your class with its config parameters.

### 3. Wire into the engine: `engine/exercise_engine.py`

Verify the `game_mode` property type hint on `ExerciseEngine` is compatible (currently typed as `ClassicMode`; widen to `GameMode` if needed). The engine delegates to the mode via `self._config.game_mode.*` — no mode-specific logic should live in `exercise_engine.py`.

### 4. Add Hypothesis strategies: `engine/strategies.py`

Add strategy functions for any new dataclass fields or config parameters your mode introduces (e.g., custom option lists, scoring factors, decision sequences). Existing strategies like `option_lists()`, `signed_option_lists()`, `penalty_factors()`, and `decision_sequences()` can be reused or composed.

### 5. Add unit and property tests

- Create `engine/game_modes/<name>_test.py` for unit tests (see `classic_test.py`, `simple_collaborative_test.py`).
- Create `engine/game_modes/<name>_prop_test.py` for property tests (see `simple_collaborative_prop_test.py`).
- Update existing engine integration tests in `features/exercise/` that exercise game mode behaviour (e.g., `engine_game_mode_test.py`, `collaborative_flow_test.py`, `engine_decision_chain_test.py`).

### 6. Add frontend support

- Update `exercise.store.ts` (`frontend/src/app/core/exercise.store.ts`) to handle the new mode's scoring snapshot shape.
- Add any mode-specific UI components to `frontend/src/app/shared/components/`.
- Update scenario builder and scenario API if the mode requires new config fields.

### 7. Add a seed scenario (optional but recommended)

Add a JSON seed file in `backend/seeds/` that exercises the new mode end-to-end. Ensure it passes `seed_validation_test.py`.

## Migration Testing
Every Alembic migration must have a working `downgrade()` function. The CI pipeline runs migration rollback tests (`tests/migration_rollback_test.py`) that:
1. Upgrade to head, then downgrade step-by-step back to base.
2. Upgrade and immediately downgrade each individual revision.

When adding a new migration:
- Always implement `downgrade()` -- never leave it as `pass`.
- Run `python -m pytest tests/migration_rollback_test.py -v` locally against a real PostgreSQL instance before pushing.
- Data migrations (INSERT/UPDATE) must have a corresponding reverse operation in `downgrade()`.

## Common Pitfalls
- Do NOT import `sqlalchemy`, `fastapi`, or `httpx` inside `engine/` — it must stay pure.
- Do NOT create a second WebSocket endpoint — extend `ws_router.py` if needed.
- Do NOT duplicate types — engine types are generated from Python, domain-config types live in `domain-config-api.service.ts`.
- Do NOT hand-edit files in `core/generated/` — run `npm run generate:types` instead.
- Do NOT put exercise-specific UI components in `packages/ui/` — they belong in `apps/tfc/frontend/src/app/shared/`.
- Do NOT mutate engine state from outside the tick loop — use engine methods (`start`, `pause`, `complete`, `reset`, `set_speed`).
- Do NOT skip `make test-tfc-backend` before committing engine changes — the engine has dedicated unit tests.
- Do NOT put game-mode-specific logic in `exercise_engine.py` — add a new class to `engine/game_modes/` instead.
- Do NOT hardcode domain labels or terminology in the frontend or engine — fetch from `features/domain_config/` API.
- Do NOT write Hypothesis property tests without a matching strategy in `engine/strategies.py`.

## Agent Development Best Practices

### Before starting any TFC task
1. Read the feature's `manifest.yaml` for API surface, dependencies, and business rules.
2. Read `apps/tfc/SPECS.md` for the full domain model and glossary — use domain terms consistently.
3. Check `SPECS.md` § Backlog and § Implementation Status for open gaps and deferred items before implementing related features.

### Specification hygiene
4. When adding a new feature: create `manifest.yaml` first, then code. The manifest is the contract.
5. When changing business rules or API endpoints: update `apps/tfc/SPECS.md` and the feature's `manifest.yaml` in the same commit as the code change. Stale specs cause agents to generate wrong code.
6. When a gap or deferred item is resolved: update its status in `SPECS.md` § Implementation Status immediately. Contradictory statuses across docs cause agents to re-fix resolved issues.
7. `SPECS.md` is the single source of truth for all TFC specs. Do NOT duplicate business rules, game mechanics, or domain definitions in other docs (AGENTS.md, README.md). Reference `SPECS.md` instead.

### Type safety across the stack
7. **Backend Python types are the single source of truth.** Engine state changes and snapshots (`backend/engine/state_changes.py`) are codegen'd to TypeScript via `apps/tfc/codegen/generate-types.py`. When you change a TypedDict, run `npm run generate:types` from `apps/tfc/frontend/`. Never hand-write frontend types that duplicate backend TypedDicts.
8. Frontend `DomainConfigResponse` (in `domain-config-api.service.ts`) mirrors the backend `DomainConfigResponse` (in `domain_config_schema.py`). These 4 types (`TerminologyMap`, `ThemeConfig`, `DomainRole`, `SeverityLevel`) are the only hand-maintained cross-stack types — everything else is generated.
9. ESLint enforces `no-unsafe-type-assertion` (no `as X` casts) and bans `TSIndexSignature` (no `[key: string]: unknown`). Both generated and hand-written code must pass these rules.

### Engine changes
10. When adding a new `GameMode` method: update the protocol in `game_modes/__init__.py`, implement in ALL existing modes (Classic + SimpleCollaborative), and add property tests with strategies.
11. When adding a new engine dataclass: add the Hypothesis strategy to `strategies.py` BEFORE writing property tests.
12. When modifying scoring formulas: update the formula documentation in `docs/plans/2026-03-17-tfc-collaborative-mode-review.md` §5.
13. When adding or changing a TypedDict in `state_changes.py`: run `npm run generate:types` and commit the regenerated `.ts` file in the same commit.

### Testing expectations
14. Engine changes require: unit tests + property tests (Hypothesis). Use existing strategies from `engine/strategies.py`.
15. Frontend feature changes require: component spec files colocated with the component.
16. API changes require: router tests in the feature's `*_test.py` file.
17. **Cross-path regression tests are the highest-value tests in TFC.** Prefer tests that verify state transitions produce identical outcomes regardless of entry path (player submit vs timeout vs force-trigger vs GM trigger) over tests that only exercise helper functions in isolation.
18. When a bug is fixed, write a regression test that exercises the same business event through multiple entry paths to confirm convergence. See `SPECS.md` § Design Invariants.

## Visual Regression Testing

### Round-trip screenshot workflow
After making visual changes to the TFC frontend (HTML, CSS, component templates):

1. **Make the change** — edit view files as needed
2. **Run visual snapshots** — `npm run e2e:visual` from `apps/tfc/frontend/`
3. **Review diffs** — if snapshots fail, inspect the HTML report (`npx playwright show-report`)
4. **Fix or update** — fix regressions, or `npm run e2e:visual:update` if the change is intentional
5. **Commit baselines** — updated `.png` snapshots in `e2e/tests/player-view-snapshots.spec.ts-snapshots/` must be committed with the code change

### Using Chrome DevTools MCP for live verification
When the dev server is running (`npm start` at `localhost:4201`):
- `mcp__chrome-devtools__navigate_page` → open the player view with query params
- `mcp__chrome-devtools__take_screenshot` → capture current state
- `mcp__chrome-devtools__take_snapshot` → inspect DOM structure and element UIDs
- Compare screenshots against design intent or previous state

### Visual test conventions
- All visual snapshot tests are tagged `@visual` — run with `npm run e2e:visual`
- Mask time-dependent elements: `tfc-ambient-background`, `tfc-clock-display`
- Max diff pixel ratio: `0.02` (2% tolerance for anti-aliasing)
- Baselines stored in `e2e/tests/player-view-snapshots.spec.ts-snapshots/`
- A PostToolUse hook prints a reminder when frontend view files are edited
