# Migration Plan: `@aspect/ui` → React Component Library (`@aspect/react-ui`)

## Background

`packages/ui/` (`@aspect/ui`) is currently an **Angular 21 library** built with `ng-packagr`. It contains ~30 components and directives covering: buttons, inputs, badges, cards, dialogs, drawers, collapsible panels, tabs, data tables (with filtering and tree filtering), a histogram timeline, a MapLibre map wrapper, and several layout primitives (stack, grid, page-layout, sidebar-layout, page-header).

Both `apps/main` and `apps/tfc` import from it (46 TypeScript files today). The design system (`packages/design-system`) is already **framework-agnostic CSS** using OKLCH tokens and CSS layers — it has no Angular code and can be reused as-is across the migration.

---

## Open Decisions

Settle these before starting Phase 1:

| Decision | Options |
|---|---|
| **Build tool** | `tsup` (simpler, zero-config) vs Vite library mode (more Storybook-friendly) |
| **Overlay primitives** | Roll own React portals vs adopt Radix UI (unstyled, a11y-complete — aligns with design-system-owns-CSS pattern) |
| **Table engine** | TanStack Table v8 (recommended) vs rolling own (Angular CDK `CdkTable` replacement) |
| **Consumer scope** | New React apps only, or also rewriting existing Angular apps (determines urgency of Phase 4) |

---

## Phase 1 — Scaffold the New Package

1. Create `packages/react-ui/` as `@aspect/react-ui` with its own `package.json`, `tsconfig.json`, and build tooling.
2. Configure `peerDependencies`: React 18+, `@aspect/design-system` (unchanged), `maplibre-gl` (for map components).
3. Build output: ESM only, no CSS modules (design system owns all styles via class names), `.d.ts` generation.
4. Add a Storybook 8 instance inside the package for visual development, using the existing `.stories.ts` files as a reference.
5. Wire `packages/react-ui` into the root `make validate` target so its tests and linting run alongside the rest of the monorepo.

---

## Phase 2 — Migrate Components (Smallest to Largest)

Keep Angular originals intact throughout this phase. Both packages coexist until Phase 5.

### Group A — Pure CSS Wrappers (trivial, no logic)

These components are just hosts for design-system CSS classes. Map Angular `@Input()` → React props 1:1.

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

### Group C — Overlay / Panel Components (moderate — portal/CDK → React portal)

Replace Angular CDK overlay with React `createPortal`. If Radix UI is chosen in Phase 1, use Radix `Dialog` / `Collapsible` primitives as the headless base.

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

### Group F — Complex Data Components (highest effort, no external lib dep)

The filter and tree-filter TypeScript types (`data-table-filter.types.ts`, `data-table-tree-filter.types.ts`, `data-table.utils.ts`, `data-table-tree-filter.utils.ts`) are **pure TypeScript** — copy them verbatim. Replace Angular CDK `CdkTable` with TanStack Table v8 (if chosen).

| Angular | React |
|---|---|
| `DataTableComponent` + `DataTableColumnComponent` | `<DataTable>` + `<DataTableColumn>` |
| `DataTableFilterComponent` | `<DataTableFilter>` |
| `DataTableTreeFilterComponent` | `<DataTableTreeFilter>` |
| `HistogramTimelineComponent` | `<HistogramTimeline>` |

### Group G — Map Components (highest effort, external lib)

`map-view.init.ts`, `map-view.pmtiles.ts`, `map-view.style-builder.ts`, and `map-view.types.ts` are **pure TypeScript** — copy them verbatim. Only the component wrappers around MapLibre GL need rewriting.

| Angular | React |
|---|---|
| `MapViewComponent` | `<MapView>` |
| `MapLayerComponent` | `<MapLayer>` |
| `MapMarkerComponent` | `<MapMarker>` |
| `MapPopupComponent` | `<MapPopup>` |

---

## Phase 3 — Testing & Storybook

- Write **Vitest + React Testing Library** tests for each component, colocated with source files (e.g. `button.component.spec.tsx`).
- Port existing `.stories.ts` → `.stories.tsx` in Storybook 8 as each component is completed.
- Ensure `make validate` runs `packages/react-ui` tests alongside the Angular and backend suites.

---

## Phase 4 — Consumer Migration (Phased, Depends on Scope Decision)

Because both existing apps are Angular, they cannot directly consume React components without a full rewrite.

### Option A — Parallel Coexistence (recommended for now)

Keep `@aspect/ui` (Angular) for `apps/main` and `apps/tfc`. The new `@aspect/react-ui` targets **future React apps**. No consumer-side migration required immediately.

### Option B — Full App Rewrite

If one or both apps are to be rewritten in React, complete Phase 2 first, then migrate feature by feature:

1. Replace Angular feature components with React equivalents one feature folder at a time.
2. Swap `import { X } from '@aspect/ui'` → `import { X } from '@aspect/react-ui'` in each migrated file.
3. Validate with `make validate` after each feature.

---

## Phase 5 — Deprecate the Angular Library (Only After Option B)

1. Mark `packages/ui/` as deprecated in its `package.json` description.
2. Remove all remaining `@aspect/ui` imports from the migrated app(s).
3. Delete `packages/ui/` once no app or package references it.
4. Update `AGENTS.md` stack entry: `@aspect/react-ui` replaces `@aspect/ui`.
5. Remove the symlink at `frontend/src/app/shared/ui/`.
