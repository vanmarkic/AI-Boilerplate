# TFC Dedup — Single Source of Truth

> **Status:** COMPLETED (2026-03-19)

**Goal:** Eliminate redundant type definitions and duplicated handler logic across the TFC frontend so each concept has exactly one definition.

**Architecture:** Backend Python TypedDicts (`state_changes.py`) are the single source of truth. A codegen script (`codegen/generate-types.py`) produces TypeScript interfaces at `core/generated/state-changes.types.ts`. Hand-maintained frontend types survive only where they represent frontend-specific concerns (e.g., `ActiveDecision`, `ScoreSnapshot`). Shared WS handler logic lives in `core/ws-state-handler.ts`. The `@aspect/tfc-shared` package was deleted — its types were redundant.

**Tech Stack:** Angular 21, TypeScript, ngrx signalStore, Python codegen

---

## What was done

### 1. Python → TypeScript codegen pipeline

**Commits:** `d425633`, `f1ab9be`

Created `apps/tfc/codegen/generate-types.py` that reads Python TypedDicts from `backend/engine/state_changes.py` and emits TypeScript interfaces to `frontend/src/app/core/generated/state-changes.types.ts`.

**Generated types include:**
- All 9 state change types (`PhaseChange`, `EventChange`, `IssueChange`, `DecisionOpened`, `DecisionClosed`, `SpeedChange`, `ScoreChange`, `RecommendationSubmitted`, `ForcedCardApplied`)
- Discriminated union: `StateChange`
- Snapshot types: `TimeSnapshot`, `EventSnapshot`, `IssueSnapshot`, `DecisionOptionSnapshot`, `DecisionSnapshot`, `EngineSnapshot`
- `PresenceEntry` for participant presence

**CI guard:** `codegen/check-freshness.sh` runs as `codegen-check` job in `tfc-frontend-ci.yml` — fails if generated output is stale vs Python source.

**Run locally:** `npm run generate:types` from `apps/tfc/frontend/`.

### 2. Deleted `@aspect/tfc-shared` package

**Commit:** `c290e4b`

The package contained camelCase domain types that duplicated backend TypedDicts. All 4 domain-config types (`TerminologyMap`, `ThemeConfig`, `DomainRole`, `SeverityLevel`) already existed in `domain-config-api.service.ts`. The package was fully redundant.

**Removed:** `packages/tfc-shared/`, tsconfig path alias, CI/Docker references, all import statements.

### 3. Rewired `exercise-ws.service.ts` to generated types

**Commit:** `c290e4b`

Deleted all `Ws*` duplicate interfaces. The service now imports and re-exports from `generated/state-changes.types.ts`. Envelope types (`WsStateChangesMessage`, `WsSnapshotMessage`, etc.) remain as they are frontend-only WS protocol types.

### 4. Extracted shared WS handler

**Commits:** `bc6f083`, `343cfc3`, `0524ded`

Created `core/ws-state-handler.ts` with:
- `toActiveDecision(c: DecisionOpened): ActiveDecision` — maps state change to store type
- `handleStateChange(change: StateChange, store): void` — exhaustive switch over all 9 union members

Both `gm-ws-handler.ts` and `player-ws-handler.ts` delegate to the shared handler. The only difference: GM handler also handles `presence_update`.

All 9 state change types handled:
| Type | Handler action |
|------|---------------|
| `phase_change` | `applyPhaseChange` + `applyTimeUpdate` |
| `event_change` | `updateEvent` |
| `issue_change` | `updateIssue` |
| `decision_opened` | `applyDecisions` via `toActiveDecision` |
| `decision_closed` | `closeDecision` |
| `score_change` | `applyScoreChange` |
| `recommendation_submitted` | `applyRecommendation` |
| `speed_change` | `setSpeedFactor` |
| `forced_card_applied` | No-op (reflected in decision options) |

### 5. Consolidated duplicate types

**Commit:** `c290e4b`

| Before | After | Source |
|--------|-------|--------|
| `WsPhaseChange` + `PhaseChange` | `PhaseChange` | codegen |
| `WsSpeedChange` + `SpeedChange` | `SpeedChange` | codegen |
| `WsDecisionOpened` + `ActiveDecision` | `DecisionOpened` (codegen) + `ActiveDecision` (hand-written, frontend-only) | split |
| `WsScoreChange` + inline param | `ScoreChange` | codegen |
| `DecisionOption` × 3 | `DecisionOption` in `decision-api.service.ts` | hand-written |
| `RoleInfo` + `RoleDef` + inline | `RoleDef` in `scenario-api.service.ts` | hand-written |
| `DecisionOptionDef` + `DecisionOption` | `DecisionOption` in `decision-api.service.ts` | hand-written |
| `applyTimeUpdate` inline param | `TimeSnapshot` | codegen |
| `applyScoreChange` inline param | `Pick<ScoreChange, ...>` | codegen |

### 6. Fixed backend drift

**Commit:** `c290e4b`

| Field | Fix |
|-------|-----|
| `EventSnapshot.triggered_issues` | Added (now in codegen) |
| `EngineSnapshot.decisions` | Added (now in codegen) |
| `ActiveDecision.max_selections` | Added to hand-written type |
| `ParticipantPresence.role` | Changed from `string` to `string \| null` |
| `DecisionClosed.selected_option_ids` | Changed from `optional` to `required` (matches backend) |

### 7. Removed unsafe type casts

**Commit:** `c290e4b`

Eliminated `as never` (×2) and `as Record<string, unknown>` (×1) from production code. Zero `as any` / `as unknown` in non-test files.

### 8. Updated documentation

**Commit:** `20c5e3e`

Updated `AGENTS.md` with:
- Codegen section documenting `generate-types.py` and `check-freshness.sh`
- `core/generated/` directory in architecture tree
- Rule: "Do NOT hand-edit files in `core/generated/`"
- Rule: "When adding or changing a TypedDict in `state_changes.py`: run `npm run generate:types` and commit the regenerated `.ts` file in the same commit"

---

## Test coverage

`ws-state-handler.spec.ts` covers:
- `toActiveDecision` mapping (field-level assertions)
- `handleStateChange` for `phase_change` (store.phase + store.playTimeMs)
- `handleStateChange` for `decision_opened` (store.openDecisions appended)
- `handleStateChange` for `decision_closed` (store.openDecisions emptied)

---

## Key deviation from original plan

The original plan (preserved in git history) described a **hand-written** `core/state-change.types.ts` file. During implementation, this was replaced with a **codegen pipeline** that generates types from Python source. This is structurally better because:

1. Backend Python types are the single source of truth — no manual sync
2. CI freshness check prevents drift automatically
3. All 6 backend-drift bugs found in the audit are now structurally impossible
4. Adding new state change types to the backend automatically propagates to frontend

## Files changed

```
Created:
  apps/tfc/codegen/generate-types.py
  apps/tfc/codegen/check-freshness.sh
  apps/tfc/frontend/src/app/core/generated/state-changes.types.ts
  apps/tfc/frontend/src/app/core/ws-state-handler.ts
  apps/tfc/frontend/src/app/core/ws-state-handler.spec.ts

Modified:
  apps/tfc/frontend/src/app/core/engine-api.service.ts
  apps/tfc/frontend/src/app/core/exercise-ws.service.ts
  apps/tfc/frontend/src/app/core/exercise.store.ts
  apps/tfc/frontend/src/app/core/decision-api.service.ts
  apps/tfc/frontend/src/app/core/scenario-api.service.ts
  apps/tfc/frontend/src/app/features/game-master/gm-ws-handler.ts
  apps/tfc/frontend/src/app/features/player/player-ws-handler.ts
  apps/tfc/frontend/src/app/features/player/player-decision-handlers.ts
  apps/tfc/frontend/src/app/shared/decision-panel.component.ts
  apps/tfc/frontend/src/app/shared/all-advisors-panel.component.ts
  apps/tfc/frontend/package.json
  apps/tfc/frontend/tsconfig.json
  apps/tfc/AGENTS.md
  .github/workflows/tfc-frontend-ci.yml

Deleted:
  packages/tfc-shared/ (entire package)
