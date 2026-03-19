# TFC Compliance Audit Report

**Date:** 2026-03-18
**Scope:** `apps/tfc/`
**Rules checked:** Root `AGENTS.md` universal rules + `apps/tfc/AGENTS.md` TFC-specific rules

---

## Summary

| # | Rule | Status | Violations |
|---|------|--------|------------|
| U1 | Max 250 lines per file | FAIL | 3 files |
| U2 | No barrel exports (`index.ts`) | PASS | 0 |
| U6 | Strict TypeScript (`no any`) | FAIL | 3 occurrences (test file) |
| U7 | Python type hints on all functions | FAIL | 2 production files |
| U9 | Every feature has `manifest.yaml` | FAIL | 7 features missing |
| T1 | Engine purity (no SQLAlchemy/FastAPI) | PASS | 0 |
| T2 | Single WebSocket endpoint | PASS | 0 |
| T3 | ~~Shared types in `tfc-shared`~~ (deleted) | N/A | — |
| T4 | Design-system tokens (no hardcoded values) | FAIL | ~35 occurrences |
| T5 | Exercise store is single source of truth | PASS | 0 |
| T7 | No game-mode logic in `exercise_engine.py` | PASS | 0 |
| T8 | Hypothesis strategies for property tests | PASS | 0 |
| T9 | No hardcoded domain terms | PASS | 0 |

**Overall: 5 rules violated, 8 rules passing.**

---

## Violation Details

### V1 — 250-line file limit (Rule U1)

| File | Lines | Over by |
|------|-------|---------|
| `apps/tfc/backend/features/exercise/engine_router.py` | 373 | 123 |
| `apps/tfc/frontend/src/app/features/player/player-view.ts` | 295 | 45 |
| `apps/tfc/frontend/src/app/features/home/lobby-preview.ts` | 294 | 44 |

**Additional concern:** `engine_router.py` and `engine_actions_router.py` contain **9 duplicate endpoints** with identical `operation_id` values (triggerEvent, cancelEvent, completeEvent, activateIssue, mitigateIssue, resolveIssue, releaseIssue, getOpenDecisions, getEngineContext). The entity actions in `engine_router.py` should be removed since they already exist in `engine_actions_router.py` — this was the original intent of the split, but the old endpoints were never cleaned up.

**Test files also over 250 lines** (noted, not counted as critical):
- `e2e/tests/player-view-states.spec.ts` (581 lines)
- `e2e/tests/two-player-mode.spec.ts` (473 lines)
- `e2e/fixtures/base.fixture.ts` (394 lines)
- `e2e/tests/state-matrix.spec.ts` (361 lines)
- `e2e/tests/waiting-room.spec.ts` (302 lines)

---

### V2 — No `any` type in TypeScript (Rule U6)

All 3 occurrences are in one test file:

| File | Line | Code |
|------|------|------|
| `exercise.store.spec.ts` | 107 | `{ id: 'd1', ... } as any,` |
| `exercise.store.spec.ts` | 108 | `{ id: 'd2', ... } as any,` |
| `exercise.store.spec.ts` | 118 | `{ id: 'd1', ... } as any,` |

**Fix:** Create a properly typed partial or use `Partial<ActiveDecision>` instead of `as any`.

---

### V3 — Missing return type annotations (Rule U7)

| File | Line | Function |
|------|------|----------|
| `engine_actions_router.py` | 19 | `def _get_engine(exercise_id: int)` |
| `engine_router.py` | 41 | `def _get_engine(exercise_id: int)` |

Both should declare `-> ExerciseEngine:` as the return type.

---

### V4 — Missing `manifest.yaml` files (Rule U9)

All 7 TFC backend feature directories lack a `manifest.yaml`:

1. `features/audit/`
2. `features/decision/`
3. `features/domain_config/`
4. `features/exercise/`
5. `features/health/`
6. `features/scenario/`
7. `features/waiting_room/`

---

### V5 — Hardcoded pixel values instead of design tokens (Rule T4)

**CSS files** (`apps/tfc/frontend/src/app/shared/`):

| File | Examples |
|------|----------|
| `components-animations.css` | `height: 120px`, `width: 120px`, `height: 3px`, `height: 80px`, `font-size: 10px`, `width: 20px`, `height: 20px`, `min-width: 18px`, `height: 18px`, `transform: translateY(10px)`, etc. |
| `components-exercise-layout.css` | `border-bottom: 1px solid`, `border-top: 1px solid` |
| `components-decision.css` | `border: 1px solid`, `min-height: 80px`, `outline: 2px solid`, `outline-offset: 2px` |

**TypeScript component inline styles:**

| File | Violation |
|------|-----------|
| `scenario-builder-view.ts` | `style="width: 80px"` |
| `review-view.ts` | `style="width: 80px"`, `height: 4px`, `border-radius: 2px` |
| `waiting-room-view.ts` | `style="min-width: 420px; max-width: 600px;"` |

**Note:** `1px` borders are a common edge case — many design systems treat `1px` as a literal value. Transform offsets (e.g., `translateY(10px)`) are also arguably animation concerns rather than spacing tokens. The primary concern is the hardcoded `width`, `height`, `font-size`, and `min-height` values that should use `var(--spacing-*)` or `var(--font-size-*)` tokens.

---

## Passing Rules (Highlights)

- **Engine purity (T1):** Zero imports of `sqlalchemy`, `fastapi`, `httpx`, or `starlette` inside `engine/`. Clean architectural boundary.
- **Game-mode delegation (T7):** All mode-specific logic properly delegated via `self._config.game_mode.*()` calls. No mode-specific code in `exercise_engine.py`.
- **Domain terminology (T9):** Frontend uses `domain.term('event')`, `domain.term('issue')`, etc. No hardcoded domain labels.
- **No barrel exports (U2):** No `index.ts` re-export files found.
- **Single WebSocket (T2):** Only `ws_router.py` defines a WebSocket endpoint.
