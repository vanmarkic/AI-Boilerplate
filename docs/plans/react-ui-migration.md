# ADR: React Component Library (`@aspect/react-ui`)

| Field | Value |
|---|---|
| **Status** | Proposed |
| **Date** | 2026-03-25 |
| **Deciders** | TBD |
| **Scope** | `apps/main/frontend` (supplementary to Angular) |

---

## Context

`packages/ui/` (`@aspect/ui`) is an **Angular 21 library** built with `ng-packagr`. It contains **24 components + 2 directives** covering: buttons, inputs, badges, cards, dialogs, drawers, collapsible panels, tabs, data tables (with filtering and tree filtering), a histogram timeline, a MapLibre map wrapper, and layout primitives (stack, grid, page-layout, sidebar-layout, page-header).

Current usage across apps:

| App | Files importing `@aspect/ui` | Total import occurrences |
|---|---|---|
| `apps/main/frontend` | 9 | 35 |
| `apps/tfc/frontend` | 37 | 130 |
| **Total** | **50** | **165** |

The design system (`packages/design-system`) is already **framework-agnostic CSS** using OKLCH tokens and CSS layers. It has zero Angular code and works with any framework out of the box. Only the thin component wrappers in `packages/ui/` are Angular-specific.

This ADR proposes creating `@aspect/react-ui` as an **additional** library alongside `@aspect/ui`. The Angular library remains the primary UI layer for `apps/tfc`. The React library targets `apps/main/frontend` and any future React apps.

---

## Decision Drivers

- React has a larger ecosystem and hiring pool
- `apps/main/frontend` has lighter UI usage (9 files, 35 imports) making it a viable migration target
- The design system's framework-agnostic CSS means only component wrappers need rewriting, not styles
- No React code exists in the codebase today (zero `.tsx`/`.jsx` files, no React in any `package.json`)

---

## Open Decisions

Settle these before starting Phase 1:

| Decision | Options | Recommendation |
|---|---|---|
| **Build tool** | `tsup` (simpler, zero-config) vs Vite library mode (more Storybook-friendly) | Vite — aligns with Storybook 8 |
| **Overlay primitives** | Roll own React portals vs adopt Radix UI (unstyled, a11y-complete) | Radix UI — eliminates custom a11y work for dialog/drawer/collapsible |
| **Table engine** | TanStack Table v8 vs rolling own (replace Angular CDK `CdkTable`) | TanStack Table — mature, headless, large community |

---

## Cost / Benefit Analysis

### Effort

| Category | Count | Notes |
|---|---|---|
| Components to rewrite | 24 | Map Angular `@Input()` -> React props |
| Directives to rewrite | 2 | `ButtonDirective`, `TabLinkDirective` |
| Test files to replicate | 26 | Port from Jasmine/Karma to Vitest + React Testing Library |
| Storybook stories to port | 23 | `.stories.ts` -> `.stories.tsx` |

**Angular CDK dependencies to replace:**
- `CdkTrapFocus` in `DialogPanelComponent` -> Radix Dialog or native `<dialog>` focus trap
- `CdkTable` in `DataTableComponent` -> TanStack Table v8
- CDK overlay positioning in `DrawerPanelComponent` -> React portal + CSS

### Benefits

- React ecosystem access (hooks, concurrent features, server components in future)
- Larger developer hiring pool
- `apps/main/frontend` can adopt modern React patterns
- Design system CSS is fully shared — no style duplication

### Risks

| Risk | Mitigation |
|---|---|
| Maintaining two component libraries in parallel | Design system CSS is shared; only thin wrappers differ. Changes propagate via CSS, not per-library. |
| Feature drift between Angular and React versions | Component mapping tables (below) serve as parity checklist. |
| No React consumer exists yet | Start with Group A only (pure CSS wrappers). Expand based on actual need. |

---

## Alternatives Considered

### 1. Keep Angular everywhere (status quo)

Both apps stay Angular. No additional library maintenance burden. Chosen if no React apps are planned.

### 2. Web Components wrapper

Create `@aspect/wc-ui` using Web Components (custom elements + shadow DOM). Framework-agnostic by definition. Rejected because: shadow DOM complicates design system CSS integration (styles must be explicitly adopted), and Web Component DX is weaker than React for complex components like data tables.

### 3. Incremental (recommended starting point)

Build only Group A (pure CSS wrappers: Button, Badge, Card, Stack, Grid) initially. These are trivial 1:1 mappings of CSS classes to React props. Expand to Groups B-G only when a React consumer app is in active development.

---

## Phase 1 — Scaffold the New Package

1. Create `packages/react-ui/` as `@aspect/react-ui` with `package.json`, `tsconfig.json`, and build tooling.
2. Configure `peerDependencies`: React 19+, `@aspect/design-system`, `maplibre-gl` (for map components).
3. Build output: ESM only, no CSS modules (design system owns all styles via class names), `.d.ts` generation.
4. Add a Storybook 8 instance inside the package for visual development.
5. Wire `packages/react-ui` into the root `make validate` target.

---

## Phase 2 — Migrate Components (Smallest to Largest)

Keep Angular originals intact. Both packages coexist.

### Group A — Pure CSS Wrappers (trivial, no logic)

These components are just hosts for design-system CSS classes. Map Angular `@Input()` -> React props 1:1.

| Angular | React |
|---|---|
| `ButtonDirective` + `ButtonComponent` | `<Button>` (renders `<button>` or `<a>`, props: `variant`, `size`) |
| `BadgeComponent` | `<Badge>` |
| `CardComponent` | `<Card>` |
| `CardGroupComponent` | `<CardGroup mode="...">` |
| `StackComponent` | `<Stack direction gap align justify>` |
| `GridComponent` | `<Grid cols gap>` |

### Group B — Form Primitives (light logic)

| Angular | React |
|---|---|
| `InputComponent` | `<Input>` (controlled, with label slot) |
| `FormErrorComponent` | `<FormError>` |

### Group C — Overlay / Panel Components (moderate)

Replace Angular CDK overlay with Radix UI primitives (if chosen) or React `createPortal`.

| Angular | React |
|---|---|
| `DialogPanelComponent` | `<DialogPanel>` |
| `DrawerPanelComponent` | `<DrawerPanel side="...">` |
| `CollapsiblePanelComponent` | `<CollapsiblePanel variant size>` |

### Group D — Navigation

| Angular | React |
|---|---|
| `TabNavComponent` + `TabLinkDirective` | `<TabNav>` + `<TabLink>` |

### Group E — Layout

| Angular | React |
|---|---|
| `PageLayoutComponent` | `<PageLayout>` |
| `SidebarLayoutComponent` | `<SidebarLayout side="...">` |
| `PageHeaderComponent` | `<PageHeader>` |

### Group F — Complex Data Components (highest effort)

Pure TypeScript files copy verbatim: `data-table-filter.types.ts`, `data-table-tree-filter.types.ts`, `data-table.utils.ts`, `data-table-tree-filter.utils.ts`, `data-table.sort.ts`.

| Angular | React |
|---|---|
| `DataTableComponent` + `DataTableColumnComponent` | `<DataTable>` + `<DataTableColumn>` |
| `DataTableFilterComponent` | `<DataTableFilter>` |
| `DataTableTreeFilterComponent` | `<DataTableTreeFilter>` |
| `HistogramTimelineComponent` | `<HistogramTimeline>` |

### Group G — Map Components (highest effort, external lib)

Pure TypeScript files copy verbatim: `map-view.init.ts`, `map-view.pmtiles.ts`, `map-view.style-builder.ts`, `map-view.types.ts`, `map-view.colors.ts`.

| Angular | React |
|---|---|
| `MapViewComponent` | `<MapView>` |
| `MapLayerComponent` | `<MapLayer>` |
| `MapMarkerComponent` | `<MapMarker>` |
| `MapPopupComponent` | `<MapPopup>` |

---

## Phase 3 — Testing and Storybook

- Write **Vitest + React Testing Library** tests for each component, colocated with source files.
- Port existing `.stories.ts` -> `.stories.tsx` in Storybook 8 as each component is completed.
- Ensure `make validate` runs `packages/react-ui` tests alongside the Angular and backend suites.

---

## Phase 4 — Consumer Migration (Scoped to `apps/main/frontend`)

Scope: `apps/main/frontend` only (9 files, 35 import occurrences). `apps/tfc` stays Angular.

1. Replace Angular feature components with React equivalents one feature folder at a time.
2. Swap `import { X } from '@aspect/ui'` -> `import { X } from '@aspect/react-ui'` in each migrated file.
3. Validate with `make validate` after each feature.
4. Update `apps/main/frontend/AGENTS.md` to reflect the new stack.

**Out of scope:** Migrating `apps/tfc/frontend` to React. TFC remains Angular and continues using `@aspect/ui`.

---

## Decision

**Pending.** This ADR requires a decision on whether to proceed before any implementation begins. The incremental approach (Group A only) is recommended as a low-risk starting point if a React app is planned.
