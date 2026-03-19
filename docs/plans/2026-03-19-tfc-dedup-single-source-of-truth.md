# TFC Dedup — Single Source of Truth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate redundant type definitions and duplicated handler logic across the TFC frontend so each concept has exactly one definition.

**Architecture:** The frontend has two type layers: (1) **wire-format types** in `core/` services that match the backend's snake_case JSON contract, and (2) **domain types** in `@aspect/tfc-shared` using camelCase. This plan consolidates only within the wire-format layer — it does NOT merge wire types with domain types. State change types move to a single `core/state-change.types.ts` file. Shared WS handler logic moves to `core/ws-state-handler.ts`. Duplicate component types are replaced with imports from canonical locations.

**Tech Stack:** Angular 21, TypeScript, ngrx signalStore, Karma/Jasmine tests

**Constraints:**
- ESLint bans `no-unsafe-type-assertion` and `TSIndexSignature` — all code must pass these rules
- Existing tests in `exercise.store.spec.ts` must keep passing
- Backend Python types are NOT changed (cross-language sync is out of scope)

---

## Task 1: Create `core/state-change.types.ts` — single source for all state change types

**Files:**
- Create: `apps/tfc/frontend/src/app/core/state-change.types.ts`

**Step 1: Create the consolidated types file**

This file becomes the single source of truth for all WS state-change shapes AND the HTTP response shapes that are identical to them. Import `TimeSnapshot` from `engine-api.service.ts` and `DecisionOption` from `decision-api.service.ts`.

```typescript
// core/state-change.types.ts
import type { TimeSnapshot } from "./engine-api.service";
import type { DecisionOption } from "./decision-api.service";

// ── State change types (match backend state_changes.py) ──────

export interface PhaseChange {
  type: "phase_change";
  action: string;
  phase: string;
  time: TimeSnapshot;
}

export interface EventChange {
  type: "event_change";
  event_id: string;
  action: string;
  lifecycle: string;
  title: string;
}

export interface IssueChange {
  type: "issue_change";
  issue_id: string;
  action: string;
  lifecycle: string;
  title: string;
  released: boolean;
}

export interface DecisionOpened {
  type: "decision_opened";
  id: string;
  decision_id: string;
  event_id: string | null;
  issue_id: string | null;
  title: string;
  description: string;
  question_type: string;
  options: DecisionOption[];
  completion_mode: string;
  target_roles: string[];
  timeout_ms: number;
  max_selections: number | null;
  status: string;
  opened_at_pt_ms: number;
  closed_at_pt_ms: number | null;
  recommendations: Record<string, string>;
}

export interface DecisionClosed {
  type: "decision_closed";
  decision_id: string;
  title: string;
  selected_option_ids?: string[];
}

export interface ScoreChange {
  type: "score_change";
  total_score: number;
  penalty_ms: number;
  next_decision_time_ms: number;
  turn_number: number;
}

export interface RecommendationSubmitted {
  type: "recommendation_submitted";
  decision_id: string;
  participant_id: string;
  option_id: string;
}

export interface ForcedCardApplied {
  type: "forced_card_applied";
  decision_id: string;
  forced_option_id: string;
  reason: string;
}

export interface SpeedChange {
  type: "speed_change";
  factor: number;
}

export type StateChange =
  | PhaseChange
  | EventChange
  | IssueChange
  | DecisionOpened
  | DecisionClosed
  | ScoreChange
  | RecommendationSubmitted
  | ForcedCardApplied
  | SpeedChange;
```

**Step 2: Verify the file compiles**

Run: `cd apps/tfc/frontend && npx ng build --configuration development 2>&1 | head -5`
Expected: no errors from the new file (it's not imported yet, so it's unused)

**Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/core/state-change.types.ts
git commit -m "feat(tfc): add consolidated state-change types file"
```

---

## Task 2: Add `max_selections` to `ActiveDecision` and `decisions` to `EngineSnapshot`

**Files:**
- Modify: `apps/tfc/frontend/src/app/core/decision-api.service.ts` (lines 12-27 — `ActiveDecision`)
- Modify: `apps/tfc/frontend/src/app/core/engine-api.service.ts` (lines 47-55 — `EngineSnapshot`)
- Modify: `apps/tfc/frontend/src/app/core/exercise.store.ts` (lines 149-170 — `applySnapshot`)

**Step 1: Add `max_selections` to `ActiveDecision`**

In `decision-api.service.ts`, add after `timeout_ms: number;`:
```typescript
  max_selections: number | null;
```

**Step 2: Add `decisions` to `EngineSnapshot`**

In `engine-api.service.ts`, add to the `EngineSnapshot` interface after `issues: IssueSnapshot[];`:
```typescript
  decisions: ActiveDecision[];
```

Add the import at the top of `engine-api.service.ts`:
```typescript
import type { ActiveDecision } from "./decision-api.service";
```

**Step 3: Update `applySnapshot` to apply decisions from snapshot**

In `exercise.store.ts`, in the `applySnapshot` method, add after `issues: snapshot.issues,`:
```typescript
        decisions: snapshot.decisions ?? store.decisions(),
```

**Step 4: Fix `score` field — use `ScoreSnapshot` import for `EngineSnapshot`**

No change needed — `ScoreSnapshot` is already used in `EngineSnapshot`. Just verify `score` field is typed correctly.

**Step 5: Fix existing tests**

The existing `exercise.store.spec.ts` tests call `applySnapshot` without a `decisions` field. Since we added `?? store.decisions()` fallback, existing tests pass unchanged. Verify:

Run: `cd apps/tfc/frontend && npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -20`
Expected: All existing tests pass

**Step 6: Commit**

```bash
git add apps/tfc/frontend/src/app/core/decision-api.service.ts apps/tfc/frontend/src/app/core/engine-api.service.ts apps/tfc/frontend/src/app/core/exercise.store.ts
git commit -m "feat(tfc): add max_selections to ActiveDecision, decisions to EngineSnapshot"
```

---

## Task 3: Add `triggered_issues` to frontend `EventSnapshot` and fix `ParticipantPresence.role` nullability

**Files:**
- Modify: `apps/tfc/frontend/src/app/core/engine-api.service.ts` (lines 14-25 — `EventSnapshot`)
- Modify: `apps/tfc/frontend/src/app/core/exercise.store.ts` (line 20 — `ParticipantPresence`)

**Step 1: Add `triggered_issues` to `EventSnapshot`**

In `engine-api.service.ts`, add after `dependencies: string[];`:
```typescript
  triggered_issues: string[];
```

**Step 2: Fix `ParticipantPresence.role` to allow null**

In `exercise.store.ts`, change:
```typescript
  role: string;
```
to:
```typescript
  role: string | null;
```

**Step 3: Run tests**

Run: `cd apps/tfc/frontend && npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -20`
Expected: All tests pass

**Step 4: Run lint to check for breakage from null role**

Run: `cd apps/tfc/frontend && npx ng lint 2>&1 | tail -20`
Expected: No new errors (templates using `{{ p.role }}` render `null` as empty string in Angular)

**Step 5: Commit**

```bash
git add apps/tfc/frontend/src/app/core/engine-api.service.ts apps/tfc/frontend/src/app/core/exercise.store.ts
git commit -m "fix(tfc): add triggered_issues to EventSnapshot, fix role nullability"
```

---

## Task 4: Rewire `exercise-ws.service.ts` to use consolidated types

**Files:**
- Modify: `apps/tfc/frontend/src/app/core/exercise-ws.service.ts`
- Modify: `apps/tfc/frontend/src/app/core/engine-api.service.ts` (remove `PhaseChange`, `SpeedChange`)

**Step 1: Remove duplicate types from `engine-api.service.ts`**

Delete the `PhaseChange` and `SpeedChange` interfaces (lines 57-67) from `engine-api.service.ts`. These are now in `state-change.types.ts`.

**Step 2: Update `engine-api.service.ts` imports**

Add at top of `engine-api.service.ts`:
```typescript
import type { PhaseChange, SpeedChange } from "./state-change.types";
```

Re-export for downstream consumers that import from `engine-api.service.ts`:
```typescript
export type { PhaseChange, SpeedChange } from "./state-change.types";
```

**Step 3: Replace all `Ws*` types in `exercise-ws.service.ts`**

Replace the entire types section (lines 9-137) of `exercise-ws.service.ts`. Remove all `Ws*` interfaces and the `WsStateChange` union. Instead, import and re-export from `state-change.types.ts`:

```typescript
import type { EngineSnapshot } from "./engine-api.service";
import type { ActiveDecision } from "./decision-api.service";
import type { ParticipantPresence } from "./exercise.store";
import type { ParticipantResponse } from "./waiting-room-api.service";
export type {
  StateChange,
  PhaseChange,
  EventChange,
  IssueChange,
  DecisionOpened,
  DecisionClosed,
  ScoreChange,
  RecommendationSubmitted,
  ForcedCardApplied,
  SpeedChange,
} from "./state-change.types";
import type { StateChange } from "./state-change.types";

// ── WS message envelope ──────────────────────────────────────

export interface WsStateChangesMessage {
  type: "state_changes";
  changes: StateChange[];
}

export interface WsSnapshotMessage extends EngineSnapshot {
  type: "snapshot";
}

export interface WsPresenceMessage {
  type: "presence_update";
  participants: ParticipantPresence[];
}

export interface WsExerciseStartedMessage {
  type: "exercise_started";
  exercise_id: number;
  participants: ParticipantPresence[];
}

export interface WsWaitingRoomUpdate {
  type: "waiting_room_update";
  participants: ParticipantResponse[];
}

export interface WsSimpleMessage {
  type: "exercise_stopped" | "pong";
}

export type WsMessage =
  | WsStateChangesMessage
  | WsSnapshotMessage
  | WsPresenceMessage
  | WsExerciseStartedMessage
  | WsWaitingRoomUpdate
  | WsSimpleMessage;
```

**Step 4: Update downstream imports**

Any file that imports `WsPhaseChange`, `WsEventChange`, etc. must be updated to use the new names (`PhaseChange`, `EventChange`, etc.). The handlers are rewritten in Task 5, so check `gm-engine-actions.ts`:

In `gm-engine-actions.ts`, the import `import type { PhaseChange } from "../../core/engine-api.service"` still works because `engine-api.service.ts` re-exports it.

**Step 5: Build to verify**

Run: `cd apps/tfc/frontend && npx ng build --configuration development 2>&1 | tail -20`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add apps/tfc/frontend/src/app/core/exercise-ws.service.ts apps/tfc/frontend/src/app/core/engine-api.service.ts
git commit -m "refactor(tfc): replace Ws* type duplicates with consolidated state-change types"
```

---

## Task 5: Extract shared WS handler logic to `core/ws-state-handler.ts`

**Files:**
- Create: `apps/tfc/frontend/src/app/core/ws-state-handler.ts`
- Test: `apps/tfc/frontend/src/app/core/ws-state-handler.spec.ts`

**Step 1: Write the failing test**

```typescript
// core/ws-state-handler.spec.ts
import { TestBed } from "@angular/core/testing";
import { ExerciseStore } from "./exercise.store";
import { handleStateChange, toActiveDecision } from "./ws-state-handler";
import type { DecisionOpened, PhaseChange } from "./state-change.types";

describe("ws-state-handler", () => {
  let store: InstanceType<typeof ExerciseStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ExerciseStore] });
    store = TestBed.inject(ExerciseStore);
  });

  describe("toActiveDecision", () => {
    it("maps DecisionOpened to ActiveDecision", () => {
      const opened: DecisionOpened = {
        type: "decision_opened",
        id: "d1",
        decision_id: "d1",
        event_id: null,
        issue_id: "i1",
        title: "Fix the bug?",
        description: "Choose wisely",
        question_type: "single_choice",
        options: [{ id: "o1", label: "Yes", score: 10 }],
        completion_mode: "first_response",
        target_roles: ["advisor"],
        timeout_ms: 30000,
        max_selections: 1,
        status: "open",
        opened_at_pt_ms: 5000,
        closed_at_pt_ms: null,
        recommendations: {},
      };
      const result = toActiveDecision(opened);
      expect(result.id).toBe("d1");
      expect(result.title).toBe("Fix the bug?");
      expect(result.max_selections).toBe(1);
      expect(result.status).toBe("open");
      expect(result.closed_at_pt_ms).toBeNull();
    });
  });

  describe("handleStateChange", () => {
    it("applies phase_change to store", () => {
      const change: PhaseChange = {
        type: "phase_change",
        action: "started",
        phase: "running",
        time: { play_time_ms: 1000, real_time_ms: 1000, factor: 1, paused: false },
      };
      handleStateChange(change, store);
      expect(store.phase()).toBe("running");
      expect(store.playTimeMs()).toBe(1000);
    });

    it("appends decision on decision_opened", () => {
      const change: DecisionOpened = {
        type: "decision_opened",
        id: "d1",
        decision_id: "d1",
        event_id: null,
        issue_id: null,
        title: "Test",
        description: "",
        question_type: "single_choice",
        options: [],
        completion_mode: "first_response",
        target_roles: [],
        timeout_ms: 0,
        max_selections: null,
        status: "open",
        opened_at_pt_ms: 0,
        closed_at_pt_ms: null,
        recommendations: {},
      };
      handleStateChange(change, store);
      expect(store.openDecisions().length).toBe(1);
      expect(store.openDecisions()[0].id).toBe("d1");
    });

    it("closes decision on decision_closed", () => {
      store.applyDecisions([
        { id: "d1", title: "T", status: "open" } as any,
      ]);
      handleStateChange(
        { type: "decision_closed", decision_id: "d1", title: "T" },
        store,
      );
      expect(store.openDecisions().length).toBe(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/tfc/frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/ws-state-handler.spec.ts' 2>&1 | tail -10`
Expected: FAIL — `ws-state-handler` module not found

**Step 3: Write the implementation**

```typescript
// core/ws-state-handler.ts
import type { ActiveDecision } from "./decision-api.service";
import type { ExerciseStore } from "./exercise.store";
import type {
  StateChange,
  DecisionOpened,
} from "./state-change.types";

type StoreInstance = InstanceType<typeof ExerciseStore>;

/** Convert a decision_opened state change to an ActiveDecision for the store. */
export function toActiveDecision(c: DecisionOpened): ActiveDecision {
  return {
    id: c.id,
    event_id: c.event_id,
    issue_id: c.issue_id,
    title: c.title,
    description: c.description,
    question_type: c.question_type,
    options: c.options,
    completion_mode: c.completion_mode,
    target_roles: c.target_roles,
    timeout_ms: c.timeout_ms,
    max_selections: c.max_selections,
    status: "open",
    opened_at_pt_ms: c.opened_at_pt_ms,
    closed_at_pt_ms: null,
    recommendations: c.recommendations ?? {},
  };
}

/** Apply a single state change to the exercise store. */
export function handleStateChange(
  change: StateChange,
  store: StoreInstance,
): void {
  switch (change.type) {
    case "phase_change":
      store.applyPhaseChange(change.phase);
      store.applyTimeUpdate(change.time);
      break;
    case "event_change":
      store.updateEvent(change.event_id, change.lifecycle);
      break;
    case "issue_change":
      store.updateIssue(change.issue_id, change.lifecycle, change.released);
      break;
    case "decision_opened":
      store.applyDecisions([
        ...store.openDecisions(),
        toActiveDecision(change),
      ]);
      break;
    case "decision_closed":
      store.closeDecision(change.decision_id);
      break;
    case "score_change":
      store.applyScoreChange(change);
      break;
    case "recommendation_submitted":
      store.applyRecommendation(
        change.decision_id,
        change.participant_id,
        change.option_id,
      );
      break;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/tfc/frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/ws-state-handler.spec.ts' 2>&1 | tail -10`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add apps/tfc/frontend/src/app/core/ws-state-handler.ts apps/tfc/frontend/src/app/core/ws-state-handler.spec.ts
git commit -m "feat(tfc): extract shared WS state-change handler with tests"
```

---

## Task 6: Rewrite `gm-ws-handler.ts` and `player-ws-handler.ts` to use shared handler

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/game-master/gm-ws-handler.ts`
- Modify: `apps/tfc/frontend/src/app/features/player/player-ws-handler.ts`

**Step 1: Rewrite `gm-ws-handler.ts`**

```typescript
// features/game-master/gm-ws-handler.ts
import type { WsMessage } from "../../core/exercise-ws.service";
import type { ExerciseStore } from "../../core/exercise.store";
import type { ParticipantPresence } from "../../core/exercise.store";
import { handleStateChange } from "../../core/ws-state-handler";

type StoreInstance = InstanceType<typeof ExerciseStore>;

export function handleGmWsMessage(
  msg: WsMessage,
  store: StoreInstance,
  onStopped?: () => void,
): void {
  switch (msg.type) {
    case "exercise_stopped":
      onStopped?.();
      break;
    case "snapshot":
      store.applySnapshot(msg);
      break;
    case "presence_update":
      store.updatePresence(msg.participants);
      break;
    case "state_changes":
      for (const change of msg.changes) {
        handleStateChange(change, store);
      }
      break;
  }
}
```

**Step 2: Rewrite `player-ws-handler.ts`**

```typescript
// features/player/player-ws-handler.ts
import type { WsMessage } from "../../core/exercise-ws.service";
import type { ExerciseStore } from "../../core/exercise.store";
import { handleStateChange } from "../../core/ws-state-handler";

type StoreInstance = InstanceType<typeof ExerciseStore>;

export function handlePlayerWsMessage(
  msg: WsMessage,
  store: StoreInstance,
  onStopped?: () => void,
): void {
  switch (msg.type) {
    case "exercise_stopped":
      onStopped?.();
      break;
    case "snapshot":
      store.applySnapshot(msg);
      break;
    case "state_changes":
      for (const change of msg.changes) {
        handleStateChange(change, store);
      }
      break;
  }
}
```

Note: `store.applySnapshot(msg)` now works without `as never` because `WsSnapshotMessage extends EngineSnapshot` and `EngineSnapshot` now includes `decisions`. The `type: "snapshot"` extra field is harmless — `applySnapshot` doesn't read it.

**Step 3: Build to verify no type errors**

Run: `cd apps/tfc/frontend && npx ng build --configuration development 2>&1 | tail -20`
Expected: Build succeeds with no errors

**Step 4: Run all tests**

Run: `cd apps/tfc/frontend && npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -20`
Expected: All tests pass

**Step 5: Run lint**

Run: `cd apps/tfc/frontend && npx eslint src/ 2>&1 | tail -20`
Expected: No `no-unsafe-type-assertion` or `TSIndexSignature` violations

**Step 6: Commit**

```bash
git add apps/tfc/frontend/src/app/features/game-master/gm-ws-handler.ts apps/tfc/frontend/src/app/features/player/player-ws-handler.ts
git commit -m "refactor(tfc): rewrite WS handlers to use shared state-change handler"
```

---

## Task 7: Fix `applyTimeUpdate` and `applyScoreChange` to use named types

**Files:**
- Modify: `apps/tfc/frontend/src/app/core/exercise.store.ts` (lines 173-185, 256-270)

**Step 1: Replace inline parameter types with imports**

In `exercise.store.ts`, change the `applyTimeUpdate` signature from:
```typescript
    applyTimeUpdate(time: {
      play_time_ms: number;
      real_time_ms: number;
      factor: number;
      paused: boolean;
    }): void {
```
to:
```typescript
    applyTimeUpdate(time: TimeSnapshot): void {
```

Add `TimeSnapshot` to the existing import from `./engine-api.service`:
```typescript
import type {
  EngineSnapshot,
  EventSnapshot,
  IssueSnapshot,
  TimeSnapshot,
} from "./engine-api.service";
```

Change `applyScoreChange` signature from the inline type to:
```typescript
    applyScoreChange(change: Pick<ScoreChange, "total_score" | "penalty_ms" | "next_decision_time_ms" | "turn_number">): void {
```

Add `ScoreChange` to imports:
```typescript
import type { ScoreChange } from "./state-change.types";
```

**Step 2: Run tests**

Run: `cd apps/tfc/frontend && npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -20`
Expected: All tests pass

**Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/core/exercise.store.ts
git commit -m "refactor(tfc): replace inline parameter types with named imports in store"
```

---

## Task 8: Remove duplicate `DecisionOption` from `decision-panel.component.ts`

**Files:**
- Modify: `apps/tfc/frontend/src/app/shared/decision-panel.component.ts` (lines 14-17)
- Modify: `apps/tfc/frontend/src/app/shared/all-advisors-panel.component.ts` (line 11)

**Step 1: Remove local `DecisionOption` from `decision-panel.component.ts`**

Delete:
```typescript
export interface DecisionOption {
  id: string;
  label: string;
}
```

Add import:
```typescript
import type { DecisionOption } from "../core/decision-api.service";
```

The component's `options` input typed as `DecisionOption[]` now gets the full type including `score?: number`. The template only uses `option.id` and `option.label`, so no template changes needed.

**Step 2: Update `all-advisors-panel.component.ts` import**

Change:
```typescript
import type { DecisionOption } from "./decision-panel.component";
```
to:
```typescript
import type { DecisionOption } from "../core/decision-api.service";
```

**Step 3: Build and verify**

Run: `cd apps/tfc/frontend && npx ng build --configuration development 2>&1 | tail -20`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add apps/tfc/frontend/src/app/shared/decision-panel.component.ts apps/tfc/frontend/src/app/shared/all-advisors-panel.component.ts
git commit -m "refactor(tfc): remove duplicate DecisionOption, import from canonical source"
```

---

## Task 9: Remove duplicate `RoleInfo`, consolidate to `RoleDef`

**Files:**
- Modify: `apps/tfc/frontend/src/app/core/decision-api.service.ts` (lines 60-64 — `RoleInfo`, lines 66-73 — `ScenarioContext`)
- Modify: `apps/tfc/frontend/src/app/features/player/player-decision-handlers.ts` (line 34)

**Step 1: Remove `RoleInfo` from `decision-api.service.ts`**

Delete:
```typescript
export interface RoleInfo {
  id: string;
  label: string;
  player_type: string;
}
```

Import `RoleDef` from `scenario-api.service.ts`:
```typescript
import type { RoleDef } from "./scenario-api.service";
```

Update `ScenarioContext` to use `RoleDef`:
```typescript
export interface ScenarioContext {
  title: string;
  description: string;
  briefing: string;
  objectives: string[];
  rules: string[];
  roles: RoleDef[];
}
```

Re-export for any downstream consumers:
```typescript
export type { RoleDef as RoleInfo } from "./scenario-api.service";
```

**Step 2: Update `player-decision-handlers.ts` inline type**

Change line 34:
```typescript
  roles: { id: string; label: string; player_type: string }[],
```
to:
```typescript
  roles: Pick<RoleDef, "id" | "label">[],
```

Add import:
```typescript
import type { RoleDef } from "../../core/scenario-api.service";
```

**Step 3: Build and verify**

Run: `cd apps/tfc/frontend && npx ng build --configuration development 2>&1 | tail -20`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add apps/tfc/frontend/src/app/core/decision-api.service.ts apps/tfc/frontend/src/app/features/player/player-decision-handlers.ts
git commit -m "refactor(tfc): consolidate RoleInfo/RoleDef to single RoleDef source"
```

---

## Task 10: Remove duplicate `DecisionOptionDef` from `scenario-api.service.ts`

**Files:**
- Modify: `apps/tfc/frontend/src/app/core/scenario-api.service.ts` (lines 27-31)

**Step 1: Replace `DecisionOptionDef` with `DecisionOption`**

Delete:
```typescript
export interface DecisionOptionDef {
  id: string;
  label: string;
  score: number;
}
```

Import from canonical source:
```typescript
import type { DecisionOption } from "./decision-api.service";
```

Update `DecisionTemplateDef` to use `DecisionOption`:
```typescript
  options: DecisionOption[];
```

Note: `DecisionOption` has `score?: number` (optional) while `DecisionOptionDef` had `score: number` (required). The template definition context always provides score from the scenario YAML, so this is safe. If strict enforcement is needed later, the scenario builder validator can check this.

**Step 2: Build and verify**

Run: `cd apps/tfc/frontend && npx ng build --configuration development 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/core/scenario-api.service.ts
git commit -m "refactor(tfc): remove DecisionOptionDef, reuse DecisionOption"
```

---

## Task 11: Final verification — lint, build, all tests

**Files:** None (verification only)

**Step 1: Run full lint**

Run: `cd apps/tfc/frontend && npx eslint src/ 2>&1`
Expected: No errors

**Step 2: Run full build**

Run: `cd apps/tfc/frontend && npx ng build --configuration development 2>&1 | tail -10`
Expected: Build succeeds

**Step 3: Run all tests**

Run: `cd apps/tfc/frontend && npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -20`
Expected: All tests pass

**Step 4: Verify the diff is clean — no unsafe casts remain**

Run: `cd apps/tfc/frontend && grep -rn 'as never\|as unknown\|as Record' src/app/ --include='*.ts' | grep -v '.spec.ts' | grep -v 'node_modules'`
Expected: No results (all unsafe casts removed)

---

## Summary of what was eliminated

| Before | After | Type |
|--------|-------|------|
| `WsPhaseChange` + `PhaseChange` | `PhaseChange` in `state-change.types.ts` | Duplicate type |
| `WsSpeedChange` + `SpeedChange` | `SpeedChange` in `state-change.types.ts` | Duplicate type |
| `WsDecisionOpened` + `ActiveDecision` | `DecisionOpened` + `ActiveDecision` (with `toActiveDecision` converter) | Near-duplicate |
| `WsScoreChange` + inline param | `ScoreChange` in `state-change.types.ts` | Triple definition |
| `DecisionOption` × 3 places | `DecisionOption` in `decision-api.service.ts` | Triple definition |
| `RoleInfo` + `RoleDef` + inline | `RoleDef` in `scenario-api.service.ts` | Triple definition |
| `DecisionOptionDef` + `DecisionOption` | `DecisionOption` in `decision-api.service.ts` | Duplicate type |
| `toActiveDecision` × 2 handlers | `toActiveDecision` in `ws-state-handler.ts` | Duplicate function |
| `handleStateChange` × 2 handlers | `handleStateChange` in `ws-state-handler.ts` | Duplicate function |
| `as never` × 2, `as Record<string, unknown>` × 1 | Zero unsafe casts | ESLint violations |
| `applyTimeUpdate` inline param | Uses `TimeSnapshot` | Inline re-definition |
| `applyScoreChange` inline param | Uses `ScoreChange` | Inline re-definition |
| Missing `EventSnapshot.triggered_issues` | Added | Backend drift |
| `ParticipantPresence.role: string` | `role: string \| null` | Backend drift |
| Missing `EngineSnapshot.decisions` | Added | Backend drift |
| Missing `ActiveDecision.max_selections` | Added | Backend drift |
