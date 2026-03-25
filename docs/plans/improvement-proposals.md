# Improvement Proposals — Codebase Audit (2026-03-25)

Proposals discovered through broad codebase exploration. Independent of the design system ROADMAP and React ADR.

| # | Proposal | Severity | Size | Area |
|---|---|---|---|---|
| 1 | TFC file size violations (5 files over 350 lines) | High | M | TFC frontend |
| 2 | TFC missing global error handler + HTTP interceptor | Medium | S | TFC frontend |
| 3 | TFC routes lack access guards | Medium | S | TFC frontend |
| 4 | No structured logging in either backend | Medium | M | Both backends |
| 5 | No rate limiting on public endpoints | Medium | S | Both backends |
| 6 | TFC backend mixed error handling (HTTPException vs AppError) | Low | S | TFC backend |
| 7 | Extract shared pure TypeScript from packages/ui | Low | M | packages/ui |
| 8 | No test coverage thresholds in CI | Low | XS | CI/CD |
| 9 | Main backend CORS origins hardcoded | Low | XS | Main backend |

---

## 1. TFC File Size Violations

5 TFC frontend files exceed the 350-line limit enforced by `make lint-length` (AGENTS.md rule #1):

| File | Lines |
|---|---|
| `apps/tfc/frontend/src/app/features/waiting-room/waiting-room-view.ts` | 465 |
| `apps/tfc/frontend/src/app/features/scenario-builder/scenario-setup-tab.ts` | 421 |
| `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder.store.ts` | 399 |
| `apps/tfc/frontend/src/app/features/game-master/game-master-view.ts` | 392 |
| `apps/tfc/frontend/src/app/core/exercise.store.ts` | 382 |

**Approach:** Extract child components from view templates (player lists, control panels, timer displays). Extract computed selectors or effect methods from stores into colocated helper files (e.g., `exercise.store.selectors.ts`).

**Size:** M (half day). Each file needs individual analysis to find natural split points.

---

## 2. TFC Missing Error Handling Infrastructure

The TFC frontend has no global `ErrorHandler` and no HTTP interceptor. The main app has both:
- `apps/main/frontend/src/app/core/error-handler.ts` — global ErrorHandler
- `apps/main/frontend/src/app/shared/auth/auth.interceptor.ts` — HTTP interceptor

TFC's `app.config.ts` uses bare `provideHttpClient()` with no interceptors. Exercise engine WebSocket failures and HTTP errors are unhandled at the app level.

**Approach:**
1. Create `apps/tfc/frontend/src/app/core/error-handler.ts` (mirror main app pattern)
2. Create `apps/tfc/frontend/src/app/core/http-error.interceptor.ts` for logging/normalization
3. Register both in `app.config.ts`

**Size:** S (2-3 hours)

---

## 3. TFC Route Guards Missing

TFC `app.routes.ts` has no route guards. All routes (Game Master, Player, Scenario Builder) are accessible without restriction.

Main app correctly uses `authGuard` and `permissionsGuard(canMatch)` on protected routes.

Even with TFC's backend auth currently stubbed, route guards enforce navigation flow: you shouldn't reach the player view without first joining a waiting room.

**Approach:** Add navigation guards that check exercise store state (e.g., `hasJoinedExercise`, `isGameMaster`). These work independently of backend auth.

**Files:** `apps/tfc/frontend/src/app/core/exercise.guard.ts`, `apps/tfc/frontend/src/app/app.routes.ts`

**Size:** S (2-3 hours)

---

## 4. Backend Structured Logging

Neither backend has logging configuration. Both rely on implicit stdout. The `X-Request-ID` header is already generated in middleware but never appears in logs.

TFC's exercise engine (`engine/exercise_engine.py`, 23KB) runs async state machine tasks with no logging for debugging transitions, timeouts, or tick failures.

**Approach:**
1. Add `structlog` to both backends (JSON output, request-id correlation)
2. Create logging middleware that logs request method/path/status/duration
3. Add engine-level logging to TFC's exercise engine state transitions

**Files:**
- `apps/main/backend/core/logging.py` (new)
- `apps/tfc/backend/core/logging.py` (new)
- `apps/*/backend/main.py` (wire logging on startup)
- `apps/*/backend/pyproject.toml` (add structlog dependency)

**Size:** M (half day per backend)

---

## 5. Backend Rate Limiting

No rate limiting on either backend. Public endpoints are exposed:
- `/api/health`, `/api/canary/ping`, `/api/users`, `/api/events` (main)
- `/api/health` (TFC)

SSE endpoint `/api/events` is particularly vulnerable — each subscription holds an open connection with an asyncio.Queue (max 256).

**Approach:** Add `slowapi` with per-endpoint rate limits. Public endpoints: 60 req/min. Authenticated: 300 req/min. SSE: 5 concurrent connections per IP.

**Files:**
- `apps/*/backend/core/rate_limit.py` (new)
- `apps/*/backend/pyproject.toml` (add slowapi)

**Size:** S (2-3 hours per backend)

---

## 6. TFC Backend Mixed Error Handling

TFC backend mixes `HTTPException` (FastAPI built-in) with `AppError` subclasses (custom hierarchy in `core/exceptions.py`). The middleware exception handler only catches `AppError`, so `HTTPException` errors bypass custom error formatting.

Main backend consistently uses `AppError` subclasses: `NotFoundError`, `ConflictError`, `ForbiddenError`.

**Approach:** Audit TFC routers for direct `HTTPException` raises. Replace with `AppError` subclasses. Ensure `BadRequestError(400)` exists in the hierarchy.

**Size:** S (2-3 hours)

---

## 7. Extract Shared Pure TypeScript from `packages/ui`

11 files in `packages/ui/src/` are pure TypeScript with no Angular imports:

- Data table: `data-table-filter.types.ts`, `data-table-tree-filter.types.ts`, `data-table.utils.ts`, `data-table-tree-filter.utils.ts`, `data-table.sort.ts`, `data-table.types.ts`
- Map: `map-view.init.ts`, `map-view.pmtiles.ts`, `map-view.style-builder.ts`, `map-view.types.ts`, `map-view.colors.ts`

These are locked behind `@aspect/ui` which requires `@angular/core` as a peer dependency. Extracting them into `packages/ui-core` (zero framework deps) enables reuse from any framework and is the one preparatory step from the React ADR that has standalone value.

**Approach:**
1. Create `packages/ui-core/` with `package.json`, `tsconfig.json`
2. Move the 11 pure TS files
3. Update `packages/ui` to import from `@aspect/ui-core`
4. Update `public-api.ts` re-exports for backward compatibility

**Size:** M (half day)

---

## 8. Test Coverage Thresholds

Both backends report coverage via `pytest-cov` but have no `--cov-fail-under` threshold. CI never fails on coverage regression. Frontend similarly reports coverage with no floor.

**Approach:**
1. Run coverage once to establish baseline
2. Add `--cov-fail-under=<baseline>` to `pyproject.toml` `[tool.pytest.ini_options]` for both backends
3. Add coverage threshold to frontend Angular test configs

**Files:** `apps/*/backend/pyproject.toml`, CI workflow YAML files

**Size:** XS (1 hour)

---

## 9. Main Backend CORS Hardcoding

Main backend CORS origins are hardcoded to `["http://localhost:4200"]` in `core/middleware.py`. TFC backend correctly reads from `settings.allowed_origins` environment variable.

**Approach:** Read from `ALLOWED_ORIGINS` env var with `["http://localhost:4200"]` as default. Aligns main backend with TFC's pattern.

**Files:** `apps/main/backend/core/middleware.py` (< 5 lines)

**Size:** XS (15 minutes)
