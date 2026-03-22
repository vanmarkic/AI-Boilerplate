# Scenario Creation UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Foundation Editor page and redesign the Scenario Builder with Setup/Turns tabs for turn-based authoring.

**Architecture:** New `/foundation` route for DomainConfig catalog editing. Builder redesigned with `TabNavComponent` switching between Setup (metadata + initial states) and Turns (split-panel turn editor). Old entity editors (events, issues, decisions, roles) removed — replaced by turn-based authoring.

**Tech Stack:** Angular 21 · OnPush · Signals · ngrx signalStore · @aspect/ui components · native CSS

**UI Spec:** `docs/plans/2026-03-22-scenario-creation-ui-spec.md`

**Available @aspect/ui components:** ButtonDirective, InputComponent, BadgeComponent, CardComponent, CardGroupComponent, CollapsiblePanelComponent, SidebarLayoutComponent, TabNavComponent, PageHeaderComponent, PageLayoutComponent, DialogPanelComponent

**Existing patterns to follow:**
- Editors: `scenario-event-editor.ts`, `scenario-roles-editor.ts` — expandable cards with inline edit
- Store: `scenario-builder.store.ts` — ngrx signalStore with patchState
- Actions bar: `scenario-builder-view-actions.ts` — title input, save/clone/export/import buttons
- Sidebar nav: `scenario-sidebar-nav.ts` — section links with counts
- CSS: utility classes (`flex`, `gap-sm`, `p-sm`, `text-sm`, etc.) + `input-base` class for native inputs

---

## Task 11: Foundation Editor — Route, Feature Module, and Store

**Files:**
- Create: `apps/tfc/frontend/src/app/features/foundation/foundation.routes.ts`
- Create: `apps/tfc/frontend/src/app/features/foundation/foundation.store.ts`
- Create: `apps/tfc/frontend/src/app/features/foundation/foundation-view.ts`
- Modify: `apps/tfc/frontend/src/app/app.routes.ts`

**Step 1: Create the route file**

```typescript
// foundation.routes.ts
import { Routes } from "@angular/router";
import { FoundationView } from "./foundation-view";

export const FOUNDATION_ROUTES: Routes = [
  { path: "", component: FoundationView },
];
```

**Step 2: Create the store**

ngrx signalStore that wraps `DomainConfigApiService`. State holds the loaded `DomainConfigResponse`. Methods:

```typescript
// State
interface FoundationState {
  config: DomainConfigResponse | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

// Methods needed:
loadBySlug(slug: string): void       // GET /api/domain-configs/by-slug/{slug}
save(): void                          // PUT /api/domain-configs/{id}

// Role CRUD
addRole(role: DomainRole): void
removeRole(roleId: string): void
updateRole(roleId: string, updates: Partial<DomainRole>): void

// System CRUD
addSystem(system: SystemDef): void
removeSystem(systemId: string): void
updateSystem(systemId: string, updates: Partial<SystemDef>): void

// Warfare Domain CRUD
addWarfareDomain(domain: WarfareDomainDef): void
removeWarfareDomain(domainId: string): void
updateWarfareDomain(domainId: string, updates: Partial<WarfareDomainDef>): void

// Blue Card CRUD
addBlueCard(card: BlueCardDef): void
removeBlueCard(cardId: string): void
updateBlueCard(cardId: string, updates: Partial<BlueCardDef>): void
```

Extract mutation functions to `features/foundation/domain/foundation-mutations.ts` (same pattern as turn-mutations.ts).

**Step 3: Create the view component (skeleton)**

```typescript
@Component({
  selector: "tfc-foundation-view",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [FoundationStore],
  imports: [SidebarLayoutComponent, CardComponent, ButtonDirective, InputComponent, RouterLink],
  template: `
    <ui-sidebar-layout side="left" style="--sidebar-width: 14rem; height: 100dvh">
      <div sidebar class="flex flex-col gap-md p-sm" style="height: 100%; overflow-y: auto">
        <!-- Sidebar nav: Roles · Systems · Warfare Domains · Blue Cards -->
        <a routerLink="/home" class="text-sm text-muted-foreground">← Back to Home</a>
        <!-- Section links with counts -->
      </div>
      <div class="flex flex-col gap-md p-lg" style="overflow-y: auto">
        <h2>Foundation — Silent Wake</h2>
        <!-- Four catalog sections go here (Task 11b) -->
        <p class="text-muted-foreground">Loading...</p>
      </div>
    </ui-sidebar-layout>
  `,
})
export class FoundationView implements OnInit {
  // Load DomainConfig on init
}
```

**Step 4: Register the route**

Add to `app.routes.ts`:
```typescript
{
  path: "foundation",
  loadChildren: () =>
    import("./features/foundation/foundation.routes").then(
      (m) => m.FOUNDATION_ROUTES,
    ),
},
```

**Step 5: Verify build passes**

Run: `ng build`

**Step 6: Commit**

```
feat(tfc): add foundation editor route, store, and skeleton view
```

---

## Task 11b: Foundation Editor — Catalog Section Components

**Files:**
- Create: `apps/tfc/frontend/src/app/features/foundation/foundation-catalog-section.ts`
- Modify: `apps/tfc/frontend/src/app/features/foundation/foundation-view.ts`

**What to build:**

A reusable `FoundationCatalogSection` component that renders one catalog (roles, systems, domains, or cards) as a list of expandable cards with inline editing.

**Component API:**
```typescript
@Component({ selector: "tfc-foundation-catalog-section" })
export class FoundationCatalogSection<T> {
  title = input.required<string>();          // "Roles", "Systems", etc.
  items = input.required<T[]>();             // The catalog array
  fields = input.required<FieldDef[]>();     // Which fields to show/edit
  onAdd = output<T>();
  onUpdate = output<{ id: string; updates: Partial<T> }>();
  onRemove = output<string>();               // Emits item ID
}
```

Where `FieldDef` describes each editable field:
```typescript
interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox";
  options?: string[];     // For select type
  readOnlyAfterCreate?: boolean;  // e.g., ID field
}
```

**Template pattern (per item):**
- Collapsed: shows ID badge + label/title
- Expanded: inline form with all fields
- Delete button (with confirmation or at least visual distinction)
- Add form at the bottom of the section (collapsible)

**Wire into FoundationView:**

Four instances of `<tfc-foundation-catalog-section>`:

1. Roles: fields = id, label, description
2. Systems: fields = id, label, category (select: system/weapon), description
3. Warfare Domains: fields = id, label, description
4. Blue Cards: fields = id, title, description, targets_system (checkbox)

Each wired to the corresponding store CRUD methods.

Add a global "Save" button that calls `store.save()`.

**Step: Verify build passes, commit**

```
feat(tfc): add foundation catalog section component with inline editing
```

---

## Task 12: Builder — Setup Tab (replace current global view)

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder-view.ts`
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder-view-actions.ts`
- Create: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-setup-tab.ts`
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder.store.ts` (add metadata methods if missing)

**Step 1: Create SetupTab component**

Single scrollable component with three sections:

**Section 1 — Foundation Summary**
```html
<ui-card title="Foundation — Silent Wake">
  <p>7 roles · 11 systems · 4 warfare domains · 23 blue cards</p>
  <a routerLink="/foundation">Edit Foundation →</a>
</ui-card>
```

Loads DomainConfig summary on init via `DomainConfigApiService.getBySlug("silent-wake")`. Shows counts. Expandable preview panels for each catalog (read-only).

**Section 2 — Scenario Metadata**

Form fields (using `input-base` CSS class and `ui-input` where appropriate):
- Briefing (textarea, multi-line)
- Objectives (ordered list with add/remove/reorder)
- Rules (ordered list with add/remove/reorder)
- Game Mode (two-button toggle: Classic / Collaborative)
- Score Tier Thresholds (two number inputs: lo, mid)
- Default Time Factor (number input)

Needs store methods for objectives, rules, game_mode, score_tier_thresholds. Add these to the store if they don't exist:
```typescript
setObjectives(objectives: string[]): void
setRules(rules: string[]): void
setGameMode(mode: string): void
setScoreTierThresholds(thresholds: Record<string, number>): void
```

**Section 3 — Initial State Overrides**

Two grids. Load system/domain lists from DomainConfig.

Systems grid: table with system label, category badge, operational state dropdown (green/yellow/red), power toggle (on/off).
Warfare domains grid: table with domain label, threat level dropdown (green/red).

Store the overrides in `content.initial_system_states` and `content.initial_warfare_domains`.

Needs store methods:
```typescript
setInitialSystemState(systemId: string, state: Partial<SystemStateDef>): void
setInitialWarfareDomain(domainId: string, domain: Partial<WarfareDomainDef>): void
```

**Step 2: Update builder view**

- Replace `viewMode` type from `"global" | "walkthrough"` to `"setup" | "turns"`
- Replace the Global/Walkthrough toggle button in actions with `TabNavComponent` (or simple tab buttons)
- When `viewMode() === "setup"`: render `<tfc-scenario-setup-tab />`
- When `viewMode() === "turns"`: render placeholder (Task 13 fills this in)
- Remove imports of: `ScenarioEventEditorComponent`, `ScenarioIssueEditorComponent`, `ScenarioDecisionEditorComponent`, `ScenarioRolesEditorComponent`, `ScenarioSettingsEditorComponent`, `ScenarioTurnsPlaceholderComponent`, `ScenarioWalkthroughComponent`
- Keep: sidebar nav (update sections for setup tab), action bar, error display

**Step 3: Update actions component**

- Change `viewMode` input type to `"setup" | "turns"`
- Replace toggle button label: show "Turns" when on setup, "Setup" when on turns

**Step 4: Update sidebar sections**

For setup tab: Foundation · Metadata · Initial States (replace current Roles/Events/Issues/Decisions/Turns/Settings)

**Step 5: Verify build passes, run tests, commit**

```
feat(tfc): replace builder global view with Setup/Turns tabs and setup tab component
```

---

## Task 13: Builder — Turns Tab (split-panel turn editor)

**Files:**
- Create: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-turns-tab.ts`
- Create: `apps/tfc/frontend/src/app/features/scenario-builder/turn-timeline.ts`
- Create: `apps/tfc/frontend/src/app/features/scenario-builder/turn-editor.ts`
- Create: `apps/tfc/frontend/src/app/features/scenario-builder/turn-card-picker.ts`
- Create: `apps/tfc/frontend/src/app/features/scenario-builder/turn-inject-editor.ts`
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder-view.ts`

**Step 1: Create TurnTimeline component (left panel)**

```typescript
@Component({ selector: "tfc-turn-timeline" })
export class TurnTimeline {
  turns = input.required<TurnDefinition[]>();
  selectedIndex = input<number>(0);
  onSelect = output<number>();       // Emits turn_index
  onAdd = output<void>();
  onDuplicate = output<number>();
  onDelete = output<number>();
}
```

Template: vertical list of turn items. Each shows:
- Turn index badge (0, 1, 2, ...)
- Title (truncated to ~20 chars)
- Stress delta pip: colored circle (green for +0, amber for +N, blue for -N)
- Selected state: highlighted background
- Click → emits onSelect
- Action buttons (small): duplicate, delete

"+ Add Turn" button at bottom.

Auto-create Turn 0 with `has_decisions: false` when turns array is empty.

**Step 2: Create TurnInjectEditor component**

```typescript
@Component({ selector: "tfc-turn-inject-editor" })
export class TurnInjectEditor {
  injects = input.required<TurnInjectDef[]>();
  roles = input.required<DomainRole[]>();    // From DomainConfig
  turnIndex = input.required<number>();
  onAdd = output<TurnInjectDef>();
  onRemove = output<number>();               // inject index
  onUpdate = output<{ index: number; updates: Partial<TurnInjectDef> }>();
}
```

Each inject shows:
- Role badge(s) or "All" badge
- Inject text (textarea)
- Delete button
- Add inject button at bottom with role picker + text area

**Step 3: Create TurnCardPicker component**

```typescript
@Component({ selector: "tfc-turn-card-picker" })
export class TurnCardPicker {
  catalog = input.required<BlueCardDef[]>();     // Full card catalog from DomainConfig
  selectedCards = input.required<TurnCardConfig[]>();  // Cards available this turn
  turnIndex = input.required<number>();
  maxSelections = input(2);
  onToggleCard = output<string>();               // card_id — toggles availability
  onUpdateCard = output<{ cardId: string; updates: Partial<TurnCardConfig> }>();
  onMaxSelectionsChange = output<number>();
}
```

Template:
- Checklist of all catalog cards. Checked = available this turn.
- For each checked card: expandable row with score, stress_delta, system effects, domain effects, max_plays
- System/domain effect editors: small add/remove lists with dropdowns
- Max selections input at bottom
- "Card not in catalog? Edit Foundation →" link (routerLink="/foundation")

**Step 4: Create TurnEditor component (right panel)**

```typescript
@Component({ selector: "tfc-turn-editor" })
export class TurnEditor {
  turn = input.required<TurnDefinition>();
  turnIndex = input.required<number>();
  catalog = input.required<BlueCardDef[]>();
  roles = input.required<DomainRole[]>();
  systems = input.required<SystemDef[]>();
  domains = input.required<WarfareDomainDef[]>();
}
```

Template with 5 sections (as described in UI spec):
1. Turn Header — title input, facilitator prompt textarea, has_decisions toggle, duration (conditional)
2. Injects — `<tfc-turn-inject-editor>`
3. Blue Cards — `<tfc-turn-card-picker>` (hidden when !has_decisions)
4. Turn Consequences — base_stress_delta, system/domain effects on start
5. Facilitator Notes (collapsible) — best/acceptable path card selectors + notes textareas, design notes

All edits delegate to `ScenarioBuilderStore` turn CRUD methods.

**Step 5: Create TurnsTab component (orchestrator)**

```typescript
@Component({ selector: "tfc-scenario-turns-tab" })
export class ScenarioTurnsTab {
  // Injects ScenarioBuilderStore and DomainConfigApiService
  // Loads DomainConfig catalog on init
  // Manages selectedTurnIndex signal
  // Splits layout: TurnTimeline (left, narrow) | TurnEditor (right, wide)
}
```

Template:
```html
<div class="flex" style="height: 100%">
  <div style="width: 14rem; border-right: 1px solid var(--color-border); overflow-y: auto">
    <tfc-turn-timeline
      [turns]="store.content().turns"
      [selectedIndex]="selectedTurnIndex()"
      (onSelect)="selectedTurnIndex.set($event)"
      (onAdd)="addTurn()"
      (onDuplicate)="duplicateTurn($event)"
      (onDelete)="deleteTurn($event)"
    />
  </div>
  <div style="flex: 1; overflow-y: auto; padding: var(--spacing-lg)">
    @if (selectedTurn(); as turn) {
      <tfc-turn-editor
        [turn]="turn"
        [turnIndex]="selectedTurnIndex()"
        [catalog]="catalog()"
        [roles]="roles()"
        [systems]="systems()"
        [domains]="warfareDomains()"
      />
    } @else {
      <p class="text-muted-foreground">Select or add a turn to begin editing.</p>
    }
  </div>
</div>
```

**Step 6: Wire into builder view**

In `scenario-builder-view.ts`, when `viewMode() === "turns"`: render `<tfc-scenario-turns-tab />`.

The turns tab doesn't use the sidebar layout — it has its own split panel.

**Step 7: Verify build passes, commit**

```
feat(tfc): add turn editor with timeline, inject editor, and card picker
```

---

## Task 14: Wiring — Home Page, Navigation, Cleanup

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/home/home-view.ts`
- Delete (or keep unused): old editor components that are no longer imported

**Step 1: Add Foundation to home page grid**

Add a new tac-panel after "Build Scenario":
```html
<a class="tac-panel" routerLink="/foundation">
  <span class="tac-panel__indicator">FND</span>
  <span class="tac-panel__label">Foundation</span>
  <span class="tac-panel__desc">Manage roles, systems, and blue cards</span>
</a>
```

**Step 2: Add footer links**

Below the `</nav>`, add:
```html
<footer class="home-footer" style="margin-top: var(--spacing-lg); text-align: center">
  <a routerLink="/foundation" class="text-sm text-muted-foreground" style="margin-right: var(--spacing-md)">Foundation</a>
  <a routerLink="/gm" class="text-sm text-muted-foreground">Game Master</a>
</footer>
```

**Step 3: Clean up unused imports in builder**

The builder view no longer imports:
- `ScenarioEventEditorComponent`
- `ScenarioIssueEditorComponent`
- `ScenarioDecisionEditorComponent`
- `ScenarioRolesEditorComponent`
- `ScenarioSettingsEditorComponent`
- `ScenarioTurnsPlaceholderComponent`
- `ScenarioWalkthroughComponent`

Remove these from the `imports` array. The files themselves can stay (they're not hurting anything and may be useful for reference), but they should not be imported.

**Step 4: Update validation**

Update `validate-scenario-content.ts` to validate turn-based content:
- If turns have injects or available_cards, validate:
  - Each turn with `has_decisions: true` must have at least one available card
  - Each inject must have non-empty text
  - Card IDs in available_cards should exist (if catalog is available)
- Keep existing validation (roles, decision_maker requirement) for backward compat

**Step 5: Verify full build, run all tests, commit**

```
feat(tfc): add foundation to home page, clean up builder imports, update validation
```

---

## Verification Checklist

Before declaring complete:

- [ ] `/foundation` route loads and shows catalog sections
- [ ] Foundation CRUD works: add/edit/delete roles, systems, domains, cards
- [ ] Foundation save persists to DomainConfig API
- [ ] `/builder` shows Setup | Turns tabs
- [ ] Setup tab shows foundation summary, scenario metadata, initial state overrides
- [ ] Turns tab shows timeline + turn editor
- [ ] Turn editor: add/edit/remove injects, pick cards from catalog, set scoring/effects
- [ ] Turn 0 auto-created with has_decisions=false
- [ ] "Edit Foundation" link from builder navigates to `/foundation`
- [ ] Home page shows Foundation panel and footer links
- [ ] `ng build` passes
- [ ] All existing tests pass (may need updates for removed component imports)
- [ ] New components have basic spec tests
