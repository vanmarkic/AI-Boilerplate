# Pre-Migration Checklist

Preparatory work to reduce Angular coupling and framework surface area before any React migration begins. Each item has standalone value (improves the Angular codebase) regardless of whether migration happens.

**Prerequisite:** Complete the React ADR decision (`docs/plans/react-ui-migration.md`) before starting migration-specific work. Items 1-2 below are worth doing unconditionally.

---

## Dependency Reduction Target

```
Before:
  @angular/cdk/a11y  <-- dialog, drawer (CdkTrapFocus)       --> REMOVABLE
  @angular/cdk/table <-- data-table (CdkTable, CdkColumnDef)  --> STAYS
  11 pure TS files locked inside @aspect/ui                    --> EXTRACTABLE
  WS message types locked inside Angular service file          --> EXTRACTABLE
  State handler coupled to NgRx signal store type              --> DECOUPLABLE

After:
  @angular/cdk/a11y  removed (native <dialog>)
  @angular/cdk/table remains (no framework-agnostic replacement)
  Pure TS in @aspect/ui-core (zero framework deps)
  WS types in standalone .types.ts (portable)
  State handler uses interface (any store can implement)
```

---

## Item 1: Native `<dialog>` Migration

**Status:** Also in design system ROADMAP (Tier 2). Do this first.

**Why:** `DialogPanelComponent` and `DrawerPanelComponent` are the only two consumers of `CdkTrapFocus` from `@angular/cdk/a11y`. Migrating to native `<dialog>` eliminates the entire CDK a11y dependency. The native element provides focus trapping, escape handling, backdrop, and inert — all currently done manually.

**Scope:**

| File | Change |
|---|---|
| `packages/ui/src/dialog-panel.component.ts` | Replace `<div role="dialog">` with `<dialog>`, remove `CdkTrapFocus` import, remove `(keydown.escape)` host listener, add `showModal()` call |
| `packages/ui/src/drawer-panel.component.ts` | Same pattern. Replace `<div role="dialog">` with `<dialog>`, remove `CdkTrapFocus`, remove escape handler |
| `packages/design-system/components-forms.css` | `.dialog-backdrop` -> `dialog::backdrop` |
| `packages/design-system/components-layout.css` | `.drawer-backdrop` -> `dialog::backdrop` |
| `packages/ui/package.json` | Remove `@angular/cdk` from peerDependencies if data-table is also decoupled (unlikely — see below) |

**After migration:** Dialog and drawer components become trivially portable. `<dialog>` + `showModal()` works identically in React, Vue, or vanilla JS.

**Size:** M (half day)

---

## Item 2: Extract `packages/ui-core`

**Status:** Also proposed in improvement-proposals.md (#7).

**Why:** 11 files in `packages/ui/src/` are pure TypeScript with zero Angular imports but can only be consumed via `@aspect/ui` (which requires `@angular/core` as a peer dep). Extracting them enables reuse from any framework.

**Files to extract:**

Data table logic (6 files):
- `data-table-filter.types.ts` — filter type definitions
- `data-table-tree-filter.types.ts` — tree filter types
- `data-table.types.ts` — sort state, table size types
- `data-table.utils.ts` — filter pipeline logic
- `data-table-tree-filter.utils.ts` — tree filter utilities
- `data-table.sort.ts` — sort state machine, row sorting

Map logic (5 files):
- `map-view.types.ts` — map configuration types
- `map-view.init.ts` — MapLibre initialization
- `map-view.pmtiles.ts` — PMTiles protocol registration
- `map-view.style-builder.ts` — Protomaps style generation from design tokens
- `map-view.colors.ts` — color utilities for map layers

**Package structure:**
```
packages/ui-core/
  package.json          # @aspect/ui-core, zero deps (maplibre-gl as optional peer)
  tsconfig.json         # strict, ESM, declaration generation
  src/
    data-table/         # 6 files above
    map/                # 5 files above
    index.ts            # public exports
```

**Migration steps:**
1. Create `packages/ui-core/` with package scaffold
2. Move the 11 files (preserve git history with `git mv`)
3. Update `packages/ui/src/` imports to `import { ... } from '@aspect/ui-core'`
4. Re-export from `packages/ui/src/public-api.ts` for backward compatibility
5. Wire into `make validate`

**Size:** M (half day)

---

## Item 3: Decouple `ws-state-handler.ts` from NgRx Store Type

**Why:** `handleStateChange()` in `apps/tfc/frontend/src/app/core/ws-state-handler.ts` takes `StoreInstance = InstanceType<typeof ExerciseStore>` — coupling it to the NgRx signal store. But the function body only calls interface-compatible methods (`applyPhaseChange`, `updateEvent`, etc.).

**Change:** Define an interface and program to it:

```typescript
// exercise-state-handler.types.ts (new file, pure TS)
export interface ExerciseStateHandler {
  decisions(): ActiveDecision[];
  applyPhaseChange(phase: string): void;
  applyTimeUpdate(time: TimeSnapshot): void;
  updateEvent(eventId: string, lifecycle: string): void;
  updateIssue(id: string, lifecycle: string, released?: boolean): void;
  applyDecisions(decisions: ActiveDecision[]): void;
  closeDecision(id: string, selectedOptionIds?: string[]): void;
  applyScoreChange(change: ScoreChangePick): void;
  applyRecommendation(decisionId: string, participantId: string, optionId: string): void;
  setSpeedFactor(factor: number): void;
  applySystemChange(change: SystemChangePick): void;
  applyWarfareDomainChange(change: WarfareDomainChangePick): void;
}
```

Then `handleStateChange(change: StateChange, store: ExerciseStateHandler)` becomes framework-agnostic. The NgRx signal store already satisfies this interface. A React Zustand store would too.

**Size:** S (2 hours)

---

## Item 4: Extract WS Message Types to Standalone File

**Why:** `exercise-ws.service.ts` contains both pure TypeScript interfaces (message envelopes, lines 25-61) and Angular-specific code (`@Injectable`, RxJS `Subject`). The types are needed by any WebSocket consumer regardless of framework.

**Change:**
1. Create `apps/tfc/frontend/src/app/core/exercise-ws.types.ts` with the 7 message interfaces and the `WsMessage` union type
2. Update `exercise-ws.service.ts` to import from the new file
3. Re-export from `exercise-ws.service.ts` for backward compatibility

**Size:** XS (30 minutes)

---

## Item 5: NOT Worth Extracting

These items look extractable but provide no practical benefit:

| Item | Why not |
|---|---|
| `exercise.store.ts` computed selectors | One-liner filters (`events.filter(e => e.lifecycle === "running")`). In React: `useMemo(() => ...)`. Nothing to share. |
| Store mutation methods | `patchState(store, { ... })` vs React `setState()`. Same shape, different mechanism. |
| `ExerciseWsService` reconnection logic | Uses RxJS `Subject`, Angular `OnDestroy`. React would use a `useWebSocket` hook. The patterns are fundamentally different. |
| `format-time.ts` | Already extracted as a pure function. No further work needed. |
| `generated/state-changes.types.ts` | Already pure TS, generated from backend. No further work needed. |

---

## Execution Order

```
Item 1 (native <dialog>)  ─┐
                            ├──> can run in parallel
Item 4 (WS types)         ─┤
Item 3 (state handler)    ─┘
                            │
                            v
Item 2 (packages/ui-core)  ──> depends on stable packages/ui
```

Items 1, 3, 4 are independent and can be done in parallel. Item 2 should come last since it restructures `packages/ui` and benefits from the CDK reduction in Item 1.

**Total estimated effort:** 2-3 days for all 4 items.

---

## Irreducible Angular CDK Dependency

After all 4 items, the only remaining `@angular/cdk` usage is `CdkTable` + `CdkColumnDef` in `DataTableComponent`. There is no framework-agnostic equivalent — this is the one component where React migration requires a genuine rewrite (using TanStack Table v8) rather than a port. This is expected and scoped in the React ADR (Phase 2, Group F).
