# Scenario Editor Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the ScenarioBuilder with non-destructive editing (Save as Copy, Export/Import JSON, Revert), a sidebar-based Global View layout, and a Chronological Walkthrough — while accommodating the in-flight `TurnDefinition` entity.

**Architecture:** Replace the current 2-column grid with `SidebarLayoutComponent` from `@aspect/ui`. Extract decision/role/settings editing into standalone components. Add a `viewMode` signal to toggle between Global and Walkthrough views (same route, shared store). Frontend-first — backend only needs a small clone endpoint.

**Tech Stack:** Angular 21 (standalone components, signals, zoneless), NgRx Signals, `@aspect/ui`, `@aspect/design-system` CSS tokens, FastAPI, Vitest, Playwright

**Spec:** `docs/plans/2026-03-20-scenario-editor-design.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `apps/tfc/frontend/src/app/features/scenario-builder/scenario-export.ts` | Pure functions: JSON export blob + import parsing/validation |
| `apps/tfc/frontend/src/app/features/scenario-builder/scenario-export.spec.ts` | Unit tests for export/import round-trip |
| `apps/tfc/frontend/src/app/features/scenario-builder/scenario-decision-editor.ts` | Decision template CRUD (extracted from view) |
| `apps/tfc/frontend/src/app/features/scenario-builder/scenario-roles-editor.ts` | Role CRUD |
| `apps/tfc/frontend/src/app/features/scenario-builder/scenario-settings-editor.ts` | Settings section (time factor, briefing, game_mode) |
| `apps/tfc/frontend/src/app/features/scenario-builder/scenario-sidebar-nav.ts` | Sidebar navigation with section links |
| `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder-view-actions.ts` | Action bar: Save/Copy/Export/Import/Revert + description + view toggle |
| `apps/tfc/frontend/src/app/features/scenario-builder/scenario-walkthrough.ts` | Read-only chronological event stepper |
| `apps/tfc/frontend/src/app/features/scenario-builder/scenario-turns-placeholder.ts` | Read-only turns display (future-proofing) |
| `apps/tfc/backend/features/scenario/scenario_clone_test.py` | Backend test for clone endpoint |

### Modified files
| File | Changes |
|------|---------|
| `apps/tfc/frontend/src/app/core/scenario-api.service.ts` | Add TS interfaces for TurnDefinition, SystemStateDef, SystemEffectDef, DecisionOptionDef; add `clone()` method |
| `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder.store.ts` | Add `loadedSnapshot`, `revert()`, `isDirty` computed, role CRUD, update `emptyContent` |
| `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder-view.ts` | Full rewrite: sidebar layout, sections, view toggle (~175 lines) |
| `apps/tfc/frontend/src/app/features/scenario-builder/scenario-event-editor.ts` | Add cross-reference chips for `triggered_issues` |
| `apps/tfc/frontend/src/app/features/scenario-builder/scenario-issue-editor.ts` | Add cross-reference chip for `trigger_event_id` |
| `apps/tfc/backend/features/scenario/scenario_service.py` | Add `clone_scenario()` |
| `apps/tfc/backend/features/scenario/scenario_router.py` | Add `POST /{scenario_id}/clone` |

---

## Task 1: Frontend Type Alignment

**Files:**
- Modify: `apps/tfc/frontend/src/app/core/scenario-api.service.ts`

- [ ] **Step 1: Add missing TS interfaces that mirror backend Pydantic models**

Add these interfaces after the existing `RoleDef` interface (before `ScenarioContent`):

```typescript
export interface SystemEffectDef {
  system_id: string;
  operational_state: string | null;
  power_state: boolean | null;
}

export interface SystemStateDef {
  system_id: string;
  operational_state: string | null;
  power_state: boolean | null;
}

export interface DecisionOptionDef {
  id: string;
  label: string;
  score: number;
  system_effects: SystemEffectDef[];
  targets_system: boolean;
  max_plays: number;
}

export interface TurnDefinition {
  turn_index: number;
  title: string;
  facilitator_prompt: string | null;
  has_decisions: boolean;
  inject_ids: string[];
  decision_template_id: string | null;
  base_stress_delta: number;
}
```

- [ ] **Step 2: Update ScenarioContent interface with new optional fields**

```typescript
export interface ScenarioContent {
  phases: { id: string; title: string; description: string; duration_ms: number | null; events: string[] }[];
  events: ScenarioEventDef[];
  issues: ScenarioIssueDef[];
  decision_templates: DecisionTemplateDef[];
  default_time_factor: number;
  default_event_duration_ms?: number | null;
  game_mode?: string;
  game_mode_config?: Record<string, unknown>;
  briefing?: string;
  objectives?: string[];
  rules?: string[];
  roles?: RoleDef[];
  decision_sequence?: string[];
  turns?: TurnDefinition[];
  initial_system_states?: SystemStateDef[];
  score_tier_thresholds?: Record<string, number>;
}
```

- [ ] **Step 3: Add `clone()` method to ScenarioApiService**

```typescript
clone(id: number): Observable<ScenarioResponse> {
  return this.http.post<ScenarioResponse>(
    `${this.base}/api/scenarios/${id}/clone`,
    {},
  );
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | head -20`
Expected: BUILD SUCCESSFUL (or no errors related to scenario-api.service)

- [ ] **Step 5: Commit**

```bash
git add apps/tfc/frontend/src/app/core/scenario-api.service.ts
git commit -m "feat(tfc): add TurnDefinition, SystemStateDef TS interfaces and clone API method"
```

---

## Task 2: Store Enhancements (Dirty Tracking + Revert + Role CRUD)

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder.store.ts`

- [ ] **Step 1: Update emptyContent with new fields**

```typescript
const emptyContent: ScenarioContent = {
  phases: [],
  events: [],
  issues: [],
  decision_templates: [],
  default_time_factor: 1.0,
  briefing: "",
  objectives: [],
  rules: [],
  roles: [],
  game_mode: "classic",
  turns: [],
  initial_system_states: [],
};
```

- [ ] **Step 2: Add `loadedSnapshot` to state and update interface**

```typescript
interface ScenarioBuilderState {
  scenarioId: number | null;
  title: string;
  description: string;
  content: ScenarioContent;
  saving: boolean;
  error: string | null;
  loadedSnapshot: string | null;
}
```

Initial state: `loadedSnapshot: null`

- [ ] **Step 3: Update `loadScenario()` to save snapshot**

```typescript
loadScenario(
  id: number,
  title: string,
  description: string,
  content: ScenarioContent | null,
): void {
  const c = content ?? emptyContent;
  const snapshot = JSON.stringify({ title, description, content: c });
  patchState(store, {
    scenarioId: id,
    title,
    description,
    content: c,
    loadedSnapshot: snapshot,
  });
},
```

- [ ] **Step 4: Add `revert()` method**

```typescript
revert(): void {
  const snap = store.loadedSnapshot();
  if (!snap) return;
  const { title, description, content } = JSON.parse(snap);
  patchState(store, { title, description, content });
},
```

- [ ] **Step 5: Add role CRUD methods**

```typescript
addRole(role: RoleDef): void {
  patchState(store, {
    content: {
      ...store.content(),
      roles: [...(store.content().roles ?? []), role],
    },
  });
},

removeRole(roleId: string): void {
  patchState(store, {
    content: {
      ...store.content(),
      roles: (store.content().roles ?? []).filter((r) => r.id !== roleId),
    },
  });
},

updateRole(roleId: string, updates: Partial<RoleDef>): void {
  patchState(store, {
    content: {
      ...store.content(),
      roles: (store.content().roles ?? []).map((r) =>
        r.id === roleId ? { ...r, ...updates } : r,
      ),
    },
  });
},
```

- [ ] **Step 6: Update `reset()` to clear snapshot**

```typescript
reset(): void {
  patchState(store, {
    scenarioId: null,
    title: "",
    description: "",
    content: emptyContent,
    saving: false,
    error: null,
    loadedSnapshot: null,
  });
},
```

- [ ] **Step 7: Add import for RoleDef**

Add `RoleDef` to the import from `../../core/scenario-api.service`.

- [ ] **Step 8: Verify compilation**

Run: `cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | head -20`

- [ ] **Step 9: Commit**

```bash
git add apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder.store.ts
git commit -m "feat(tfc): add dirty tracking, revert, and role CRUD to scenario builder store"
```

---

## Task 3: Backend Clone Endpoint

**Files:**
- Modify: `apps/tfc/backend/features/scenario/scenario_service.py`
- Modify: `apps/tfc/backend/features/scenario/scenario_router.py`
- Create: `apps/tfc/backend/features/scenario/scenario_clone_test.py`

- [ ] **Step 1: Write the failing test**

Create `apps/tfc/backend/features/scenario/scenario_clone_test.py`:

```python
import pytest
from httpx import AsyncClient

VALID_CONTENT = {
    "roles": [
        {"id": "co", "label": "CO", "player_type": "decision_maker"},
    ],
}


async def _create(client: AsyncClient) -> dict:
    resp = await client.post(
        "/api/scenarios",
        json={"title": "Original", "content": VALID_CONTENT},
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.mark.asyncio
async def test_clone_scenario(client: AsyncClient) -> None:
    original = await _create(client)
    resp = await client.post(f"/api/scenarios/{original['id']}/clone")
    assert resp.status_code == 201
    clone = resp.json()
    assert clone["title"] == "Original (Copy)"
    assert clone["id"] != original["id"]
    assert clone["version"] == 1
    assert clone["content"]["roles"] == VALID_CONTENT["roles"]


@pytest.mark.asyncio
async def test_clone_scenario_not_found(client: AsyncClient) -> None:
    resp = await client.post("/api/scenarios/9999/clone")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/tfc/backend && python -m pytest features/scenario/scenario_clone_test.py -v`
Expected: FAIL (404 because endpoint doesn't exist)

- [ ] **Step 3: Add `clone_scenario` to service**

In `apps/tfc/backend/features/scenario/scenario_service.py`, add method:

```python
async def clone_scenario(self, scenario_id: int) -> ScenarioResponse:
    scenario = await self.repository.get_by_id(scenario_id)
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scenario not found",
        )
    clone = Scenario(
        title=f"{scenario.title} (Copy)",
        description=scenario.description,
        domain_id=scenario.domain_id,
        content=scenario.content,
        version=1,
    )
    created = await self.repository.create(clone)
    return ScenarioResponse.model_validate(created)
```

- [ ] **Step 4: Add clone route**

In `apps/tfc/backend/features/scenario/scenario_router.py`, add:

```python
@router.post(
    "/{scenario_id}/clone",
    status_code=status.HTTP_201_CREATED,
    response_model=ScenarioResponse,
    operation_id="cloneScenario",
)
async def clone_scenario(
    scenario_id: int,
    service: ScenarioService = Depends(get_scenario_service),
) -> ScenarioResponse:
    return await service.clone_scenario(scenario_id)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/tfc/backend && python -m pytest features/scenario/scenario_clone_test.py -v`
Expected: 2 passed

- [ ] **Step 6: Run full scenario test suite**

Run: `cd apps/tfc/backend && python -m pytest features/scenario/ -v`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add apps/tfc/backend/features/scenario/scenario_clone_test.py apps/tfc/backend/features/scenario/scenario_service.py apps/tfc/backend/features/scenario/scenario_router.py
git commit -m "feat(tfc): add POST /api/scenarios/{id}/clone endpoint"
```

---

## Task 4: Export/Import Utility

**Files:**
- Create: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-export.ts`
- Create: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-export.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/tfc/frontend/src/app/features/scenario-builder/scenario-export.spec.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { exportScenarioToJson, parseScenarioImport } from "./scenario-export";
import type { ScenarioContent } from "../../core/scenario-api.service";

const sampleContent: ScenarioContent = {
  phases: [],
  events: [
    {
      id: "evt-1",
      title: "Test Event",
      description: "",
      event_type: "informational",
      scheduled_pt_ms: 60000,
      duration_ms: null,
      dependencies: [],
      triggered_issues: [],
      target_roles: [],
      role_descriptions: {},
    },
  ],
  issues: [],
  decision_templates: [],
  default_time_factor: 1.0,
  roles: [{ id: "co", label: "CO", player_type: "decision_maker" }],
};

describe("exportScenarioToJson", () => {
  it("produces a valid JSON blob", () => {
    const blob = exportScenarioToJson("Test", "Desc", sampleContent);
    expect(blob.type).toBe("application/json");
  });
});

describe("parseScenarioImport", () => {
  it("round-trips through export and import", () => {
    const blob = exportScenarioToJson("Test", "Desc", sampleContent);
    // Blob.text() is async, so test the underlying JSON string
    const json = JSON.stringify({ title: "Test", description: "Desc", content: sampleContent }, null, 2);
    const result = parseScenarioImport(json);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Test");
    expect(result!.description).toBe("Desc");
    expect(result!.content.events).toHaveLength(1);
  });

  it("rejects invalid JSON", () => {
    expect(parseScenarioImport("not json")).toBeNull();
  });

  it("rejects JSON without title", () => {
    expect(parseScenarioImport(JSON.stringify({ content: {} }))).toBeNull();
  });

  it("rejects JSON without content", () => {
    expect(parseScenarioImport(JSON.stringify({ title: "T" }))).toBeNull();
  });

  it("defaults missing description to empty string", () => {
    const json = JSON.stringify({ title: "T", content: sampleContent });
    const result = parseScenarioImport(json);
    expect(result).not.toBeNull();
    expect(result!.description).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/tfc/frontend && npx vitest run src/app/features/scenario-builder/scenario-export.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement export/import functions**

Create `apps/tfc/frontend/src/app/features/scenario-builder/scenario-export.ts`:

```typescript
import type { ScenarioContent } from "../../core/scenario-api.service";

export interface ScenarioExport {
  title: string;
  description: string;
  content: ScenarioContent;
}

export function exportScenarioToJson(
  title: string,
  description: string,
  content: ScenarioContent,
): Blob {
  const data: ScenarioExport = { title, description, content };
  return new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
}

export function parseScenarioImport(
  jsonString: string,
): ScenarioExport | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj["title"] !== "string") return null;
  if (typeof obj["content"] !== "object" || obj["content"] === null) return null;
  return {
    title: obj["title"],
    description: typeof obj["description"] === "string" ? obj["description"] : "",
    content: obj["content"] as ScenarioContent,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/tfc/frontend && npx vitest run src/app/features/scenario-builder/scenario-export.spec.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add apps/tfc/frontend/src/app/features/scenario-builder/scenario-export.ts apps/tfc/frontend/src/app/features/scenario-builder/scenario-export.spec.ts
git commit -m "feat(tfc): add scenario JSON export/import utility with tests"
```

---

## Task 5: Extract Decision Editor Component

**Files:**
- Create: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-decision-editor.ts`
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder-view.ts` (remove inline decision template code)

- [ ] **Step 1: Create `scenario-decision-editor.ts`**

Extract the decision template card from `scenario-builder-view.ts` into a standalone component following the same pattern as `scenario-event-editor.ts` and `scenario-issue-editor.ts`. The component:
- Injects `ScenarioBuilderStore`
- Uses `editingId` signal pattern for inline expand/edit
- Has add form at bottom
- Uses `DomainService` for terminology (`domain.term('decision')`)

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import {
  CardComponent,
  ButtonDirective,
  InputComponent,
  BadgeComponent,
} from "@aspect/ui";
import { DomainService } from "../../core/domain.service";
import type { DecisionTemplateDef } from "../../core/scenario-api.service";
import { ScenarioBuilderStore } from "./scenario-builder.store";

@Component({
  selector: "tfc-scenario-decision-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, ButtonDirective, InputComponent, BadgeComponent],
  template: `
    <ui-card [title]="domain.term('decision') + ' Templates'">
      @for (dt of store.content().decision_templates; track dt.id) {
        <div class="flex flex-col gap-xs p-sm border-b">
          @if (editingId() === dt.id) {
            <div class="flex flex-col gap-xs">
              <ui-input
                id="edit-dt-title"
                label="Title"
                [value]="editTitle()"
                (valueChange)="editTitle.set($event)"
              />
              <ui-input
                id="edit-dt-desc"
                label="Description"
                [value]="editDesc()"
                (valueChange)="editDesc.set($event)"
              />
              <div class="flex gap-sm">
                <ui-input
                  id="edit-dt-issue"
                  label="Issue ID"
                  [value]="editIssueId()"
                  (valueChange)="editIssueId.set($event)"
                />
                <div class="flex flex-col gap-xs" style="flex:1">
                  <label class="text-xs">Question Type</label>
                  <select
                    class="input-base"
                    [value]="editQType()"
                    (change)="editQType.set(sel($event))"
                  >
                    <option value="single_choice">Single Choice</option>
                    <option value="multi_choice">Multi Choice</option>
                    <option value="free_text">Free Text</option>
                  </select>
                </div>
              </div>
              <div class="flex gap-sm">
                <button uiButton variant="default" size="sm" (click)="save(dt.id)">Save</button>
                <button uiButton variant="outline" size="sm" (click)="editingId.set(null)">Cancel</button>
              </div>
            </div>
          } @else {
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-medium">{{ dt.title }}</span>
                <ui-badge variant="secondary">{{ dt.question_type }}</ui-badge>
                @if (dt.issue_id) {
                  <span
                    class="text-xs text-muted-foreground ml-sm cursor-pointer"
                    style="text-decoration: underline dotted"
                    (click)="scrollTo('issue-' + dt.issue_id)"
                  >issue: {{ dt.issue_id }}</span>
                }
              </div>
              <div class="flex gap-xs">
                <button uiButton variant="outline" size="sm" (click)="edit(dt)">Edit</button>
                <button uiButton variant="destructive" size="sm" (click)="store.removeDecisionTemplate(dt.id)">Remove</button>
              </div>
            </div>
          }
        </div>
      } @empty {
        <p class="text-muted-foreground text-sm p-sm">No decision templates yet.</p>
      }
      <div class="flex gap-sm p-sm border-t">
        <ui-input id="dt-title" label="" placeholder="Decision title" [(value)]="newTitle" />
        <ui-input id="dt-issue" label="" placeholder="Issue ID" [(value)]="newIssueId" />
        <button uiButton variant="outline" size="sm" (click)="add()">Add</button>
      </div>
    </ui-card>
  `,
})
export class ScenarioDecisionEditorComponent {
  protected readonly store = inject(ScenarioBuilderStore);
  protected readonly domain = inject(DomainService);
  private counter = 0;

  protected readonly newTitle = signal("");
  protected readonly newIssueId = signal("");
  protected readonly editingId = signal<string | null>(null);
  protected readonly editTitle = signal("");
  protected readonly editDesc = signal("");
  protected readonly editIssueId = signal("");
  protected readonly editQType = signal("single_choice");

  protected sel(event: Event): string {
    const target = event.target;
    if (target instanceof HTMLSelectElement) return target.value;
    return "";
  }

  protected scrollTo(elementId: string): void {
    document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  protected add(): void {
    const title = this.newTitle().trim();
    const issueId = this.newIssueId().trim();
    if (!title || !issueId) return;
    this.store.addDecisionTemplate({
      id: `dt-${++this.counter}`,
      title,
      description: "",
      issue_id: issueId,
      question_type: "single_choice",
      options: [],
      completion_mode: "first_response",
    });
    this.newTitle.set("");
    this.newIssueId.set("");
  }

  protected edit(dt: DecisionTemplateDef): void {
    this.editingId.set(dt.id);
    this.editTitle.set(dt.title);
    this.editDesc.set(dt.description);
    this.editIssueId.set(dt.issue_id);
    this.editQType.set(dt.question_type);
  }

  protected save(dtId: string): void {
    this.store.updateDecisionTemplate(dtId, {
      title: this.editTitle(),
      description: this.editDesc(),
      issue_id: this.editIssueId(),
      question_type: this.editQType(),
    });
    this.editingId.set(null);
  }
}
```

- [ ] **Step 2: Remove inline decision template code from `scenario-builder-view.ts`**

Replace the `<ui-card [title]="domain.term('decision')...">` block with `<tfc-scenario-decision-editor />`. Add `ScenarioDecisionEditorComponent` to imports. Remove `editingDtId`, `editDtTitle`, `editDtDesc`, `editDtIssueId`, `editDtQType`, `newDtTitle`, `newDtIssueId`, `addDt()`, `editDt()`, `saveDt()` — all now live on the extracted component.

- [ ] **Step 3: Verify compilation**

Run: `cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add apps/tfc/frontend/src/app/features/scenario-builder/scenario-decision-editor.ts apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder-view.ts
git commit -m "refactor(tfc): extract decision editor into standalone component"
```

---

## Task 6: Roles Editor Component

**Files:**
- Create: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-roles-editor.ts`

- [ ] **Step 1: Create `scenario-roles-editor.ts`**

Same pattern as event/issue editors. Manages `roles[]` via store's `addRole`/`removeRole`/`updateRole`.

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import {
  CardComponent,
  ButtonDirective,
  InputComponent,
  BadgeComponent,
} from "@aspect/ui";
import type { RoleDef } from "../../core/scenario-api.service";
import { ScenarioBuilderStore } from "./scenario-builder.store";

@Component({
  selector: "tfc-scenario-roles-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, ButtonDirective, InputComponent, BadgeComponent],
  template: `
    <ui-card title="Roles">
      @for (role of store.content().roles ?? []; track role.id) {
        <div class="flex flex-col gap-xs p-sm border-b" [id]="'role-' + role.id">
          @if (editingId() === role.id) {
            <div class="flex flex-col gap-xs">
              <ui-input id="edit-role-id" label="ID" [value]="editId()" (valueChange)="editId.set($event)" />
              <ui-input id="edit-role-label" label="Label" [value]="editLabel()" (valueChange)="editLabel.set($event)" />
              <div class="flex flex-col gap-xs" style="flex:1">
                <label class="text-xs">Player Type</label>
                <select class="input-base" [value]="editPlayerType()" (change)="editPlayerType.set(sel($event))">
                  <option value="decision_maker">Decision Maker</option>
                  <option value="advisor">Advisor</option>
                </select>
              </div>
              <div class="flex gap-sm">
                <button uiButton variant="default" size="sm" (click)="save(role.id)">Save</button>
                <button uiButton variant="outline" size="sm" (click)="editingId.set(null)">Cancel</button>
              </div>
            </div>
          } @else {
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-medium">{{ role.label }}</span>
                <ui-badge variant="secondary">{{ role.player_type }}</ui-badge>
                <span class="text-xs text-muted-foreground ml-sm">{{ role.id }}</span>
              </div>
              <div class="flex gap-xs">
                <button uiButton variant="outline" size="sm" (click)="edit(role)">Edit</button>
                <button uiButton variant="destructive" size="sm" (click)="store.removeRole(role.id)">Remove</button>
              </div>
            </div>
          }
        </div>
      } @empty {
        <p class="text-muted-foreground text-sm p-sm">No roles yet.</p>
      }
      <div class="flex gap-sm p-sm border-t">
        <ui-input id="role-id" label="" placeholder="Role ID" [(value)]="newId" />
        <ui-input id="role-label" label="" placeholder="Label" [(value)]="newLabel" />
        <button uiButton variant="outline" size="sm" (click)="add()">Add</button>
      </div>
    </ui-card>
  `,
})
export class ScenarioRolesEditorComponent {
  protected readonly store = inject(ScenarioBuilderStore);
  private counter = 0;

  protected readonly newId = signal("");
  protected readonly newLabel = signal("");
  protected readonly editingId = signal<string | null>(null);
  protected readonly editId = signal("");
  protected readonly editLabel = signal("");
  protected readonly editPlayerType = signal("advisor");

  protected sel(event: Event): string {
    const target = event.target;
    if (target instanceof HTMLSelectElement) return target.value;
    return "";
  }

  protected add(): void {
    const id = this.newId().trim();
    const label = this.newLabel().trim();
    if (!id || !label) return;
    this.store.addRole({ id, label, player_type: "advisor" });
    this.newId.set("");
    this.newLabel.set("");
  }

  protected edit(role: RoleDef): void {
    this.editingId.set(role.id);
    this.editId.set(role.id);
    this.editLabel.set(role.label);
    this.editPlayerType.set(role.player_type);
  }

  protected save(roleId: string): void {
    this.store.updateRole(roleId, {
      id: this.editId(),
      label: this.editLabel(),
      player_type: this.editPlayerType(),
    });
    this.editingId.set(null);
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/features/scenario-builder/scenario-roles-editor.ts
git commit -m "feat(tfc): add roles editor component for scenario builder"
```

---

## Task 7: Settings Editor Component

**Files:**
- Create: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-settings-editor.ts`

- [ ] **Step 1: Create `scenario-settings-editor.ts`**

Extract the Settings card from `scenario-builder-view.ts`:

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from "@angular/core";
import { CardComponent, InputComponent } from "@aspect/ui";
import { ScenarioBuilderStore } from "./scenario-builder.store";

@Component({
  selector: "tfc-scenario-settings-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, InputComponent],
  template: `
    <ui-card title="Settings">
      <div class="flex flex-col gap-sm p-sm">
        <div class="flex items-center gap-sm">
          <span class="text-sm">Default Time Factor:</span>
          <input
            type="number"
            class="input-base"
            style="width: var(--container-xs, 5rem)"
            [value]="store.content().default_time_factor"
            (change)="onTimeFactorChange($event)"
          />
        </div>
        <div class="flex flex-col gap-xs">
          <span class="text-sm">Briefing:</span>
          <textarea
            class="input-base"
            rows="3"
            [value]="store.content().briefing ?? ''"
            (input)="onBriefingChange($event)"
          ></textarea>
        </div>
      </div>
    </ui-card>
  `,
})
export class ScenarioSettingsEditorComponent {
  protected readonly store = inject(ScenarioBuilderStore);

  protected onTimeFactorChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const val = parseFloat(target.value);
    if (val > 0) this.store.setTimeFactor(val);
  }

  protected onBriefingChange(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      this.store.setBriefing(target.value);
    }
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/features/scenario-builder/scenario-settings-editor.ts
git commit -m "refactor(tfc): extract settings editor into standalone component"
```

---

## Task 8: Sidebar Navigation Component

**Files:**
- Create: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-sidebar-nav.ts`

- [ ] **Step 1: Create `scenario-sidebar-nav.ts`**

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { BadgeComponent } from "@aspect/ui";

export interface SidebarSection {
  id: string;
  label: string;
  count: number;
}

@Component({
  selector: "tfc-scenario-sidebar-nav",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `
    <nav class="flex flex-col gap-xs p-sm" style="position: sticky; top: 0">
      @for (section of sections(); track section.id) {
        <a
          class="flex items-center justify-between p-xs rounded text-sm cursor-pointer"
          [class.font-medium]="activeSection() === section.id"
          [style.background-color]="activeSection() === section.id ? 'var(--color-muted)' : 'transparent'"
          (click)="onSectionClick(section.id)"
        >
          {{ section.label }}
          <ui-badge variant="secondary">{{ section.count }}</ui-badge>
        </a>
      }
    </nav>
  `,
})
export class ScenarioSidebarNavComponent {
  readonly sections = input.required<SidebarSection[]>();
  readonly activeSection = input<string>("");
  readonly sectionClick = output<string>();

  protected onSectionClick(sectionId: string): void {
    this.sectionClick.emit(sectionId);
    document.getElementById(`section-${sectionId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/features/scenario-builder/scenario-sidebar-nav.ts
git commit -m "feat(tfc): add sidebar navigation component for scenario builder"
```

---

## Task 9: Turns Placeholder Component

**Files:**
- Create: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-turns-placeholder.ts`

- [ ] **Step 1: Create `scenario-turns-placeholder.ts`**

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from "@angular/core";
import { CardComponent, BadgeComponent } from "@aspect/ui";
import { ScenarioBuilderStore } from "./scenario-builder.store";

@Component({
  selector: "tfc-scenario-turns-placeholder",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, BadgeComponent],
  template: `
    <ui-card title="Turns">
      @if ((store.content().turns ?? []).length > 0) {
        @for (turn of store.content().turns ?? []; track turn.turn_index) {
          <div class="flex items-center gap-sm p-sm border-b">
            <ui-badge variant="secondary">{{ turn.turn_index }}</ui-badge>
            <span class="text-sm font-medium">{{ turn.title || 'Turn ' + turn.turn_index }}</span>
            @if (turn.base_stress_delta !== 0) {
              <span class="text-xs text-muted-foreground">
                stress: {{ turn.base_stress_delta > 0 ? '+' : '' }}{{ turn.base_stress_delta }}
              </span>
            }
            @for (injectId of turn.inject_ids; track injectId) {
              <ui-badge variant="outline">{{ injectId }}</ui-badge>
            }
          </div>
        }
      } @else {
        <p class="text-muted-foreground text-sm p-sm">
          No turns defined. Turns group injects and decisions into sequential steps.
        </p>
      }
    </ui-card>
  `,
})
export class ScenarioTurnsPlaceholderComponent {
  protected readonly store = inject(ScenarioBuilderStore);
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/features/scenario-builder/scenario-turns-placeholder.ts
git commit -m "feat(tfc): add read-only turns placeholder component"
```

---

## Task 10: Chronological Walkthrough Component

**Files:**
- Create: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-walkthrough.ts`

Reuse: `formatTimeMs` from `apps/tfc/frontend/src/app/core/format-time.ts`

- [ ] **Step 1: Create `scenario-walkthrough.ts`**

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { CardComponent, ButtonDirective, BadgeComponent } from "@aspect/ui";
import { formatTimeMs } from "../../core/format-time";
import { ScenarioBuilderStore } from "./scenario-builder.store";

@Component({
  selector: "tfc-scenario-walkthrough",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, ButtonDirective, BadgeComponent],
  template: `
    @if (sortedEvents().length === 0) {
      <div class="flex items-center justify-center p-2xl">
        <p class="text-muted-foreground">No events to walk through.</p>
      </div>
    } @else {
      <div class="flex flex-col items-center gap-lg p-lg" style="max-width: 40rem; margin: 0 auto">
        @let event = sortedEvents()[safeIndex()];
        <ui-card [title]="event.title" style="width: 100%">
          <div class="flex flex-col gap-sm p-sm">
            <div class="flex gap-sm items-center">
              <ui-badge variant="secondary">{{ event.event_type }}</ui-badge>
              <span class="text-sm text-muted-foreground">{{ formatTime(event.scheduled_pt_ms) }}</span>
              @if (event.duration_ms) {
                <span class="text-xs text-muted-foreground">duration: {{ formatTime(event.duration_ms) }}</span>
              }
            </div>
            @if (event.description) {
              <p class="text-sm">{{ event.description }}</p>
            }
            @if (event.target_roles.length > 0) {
              <div class="flex gap-xs items-center">
                <span class="text-xs text-muted-foreground">Roles:</span>
                @for (role of event.target_roles; track role) {
                  <ui-badge variant="outline">{{ role }}</ui-badge>
                }
              </div>
            }
            @if (event.triggered_issues.length > 0) {
              <div class="flex gap-xs items-center">
                <span class="text-xs text-muted-foreground">Triggers:</span>
                @for (issueId of event.triggered_issues; track issueId) {
                  <ui-badge variant="outline">{{ issueId }}</ui-badge>
                }
              </div>
            }
          </div>
        </ui-card>

        <div class="flex items-center gap-md">
          <button
            uiButton
            variant="outline"
            [disabled]="safeIndex() === 0"
            (click)="currentIndex.set(safeIndex() - 1)"
          >Previous</button>
          <span class="text-sm text-muted-foreground">
            Event {{ safeIndex() + 1 }} of {{ sortedEvents().length }}
            — {{ formatTime(event.scheduled_pt_ms) }}
          </span>
          <button
            uiButton
            variant="outline"
            [disabled]="safeIndex() >= sortedEvents().length - 1"
            (click)="currentIndex.set(safeIndex() + 1)"
          >Next</button>
        </div>
      </div>
    }
  `,
})
export class ScenarioWalkthroughComponent {
  private readonly store = inject(ScenarioBuilderStore);

  protected readonly sortedEvents = computed(() =>
    [...this.store.content().events].sort(
      (a, b) => a.scheduled_pt_ms - b.scheduled_pt_ms,
    ),
  );

  protected readonly currentIndex = signal(0);

  /** Clamp index to valid range when events change */
  protected readonly safeIndex = computed(() => {
    const len = this.sortedEvents().length;
    if (len === 0) return 0;
    return Math.min(this.currentIndex(), len - 1);
  });

  protected formatTime(ms: number): string {
    return formatTimeMs(ms);
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/features/scenario-builder/scenario-walkthrough.ts
git commit -m "feat(tfc): add chronological walkthrough component"
```

---

## Task 11: Add `loadImport` to Store

Before rewriting the view, add the `loadImport` method needed by the import flow.

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder.store.ts`

- [ ] **Step 1: Add `loadImport` method**

```typescript
loadImport(title: string, description: string, content: ScenarioContent): void {
  patchState(store, {
    scenarioId: null,
    title,
    description,
    content,
    loadedSnapshot: null,
    error: null,
  });
},
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder.store.ts
git commit -m "feat(tfc): add loadImport method to scenario builder store"
```

---

## Task 12: Rewrite Main View — Action Bar (scenario-builder-view-actions.ts)

Split the main view into two files to stay under 350 lines. This task creates the action bar as a separate component.

**Files:**
- Create: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder-view-actions.ts`

- [ ] **Step 1: Create `scenario-builder-view-actions.ts`**

This component handles the top action bar: title, description, Save/Copy/Export/Import/Revert buttons, and view toggle.

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import {
  ButtonDirective,
  InputComponent,
  CollapsiblePanelComponent,
} from "@aspect/ui";
import { ScenarioBuilderStore } from "./scenario-builder.store";
import { exportScenarioToJson, parseScenarioImport } from "./scenario-export";

@Component({
  selector: "tfc-scenario-builder-actions",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, InputComponent, CollapsiblePanelComponent],
  template: `
    <div class="flex flex-col gap-sm">
      <div class="flex items-center gap-sm flex-wrap">
        <ui-input
          id="scenario-title"
          label=""
          placeholder="Scenario title"
          [value]="store.title()"
          (valueChange)="store.setTitle($event)"
          style="flex: 1; min-width: 12rem"
        />
        <button uiButton (click)="onSave.emit()">
          {{ store.scenarioId() ? 'Update' : 'Create' }}
        </button>
        @if (store.scenarioId()) {
          <button uiButton variant="outline" (click)="onSaveAsCopy.emit()">Save as Copy</button>
          <button uiButton variant="outline" (click)="store.reset()">New</button>
        }
        <button uiButton variant="outline" (click)="exportJson()">Export</button>
        <button uiButton variant="outline" (click)="fileInput()?.nativeElement?.click()">Import</button>
        @if (isDirty()) {
          <button uiButton variant="outline" (click)="store.revert()">Revert</button>
        }
        <button
          uiButton
          variant="outline"
          (click)="onToggleView.emit()"
        >{{ viewMode() === 'global' ? 'Walkthrough' : 'Global' }}</button>
      </div>

      <ui-collapsible-panel>
        <span panelTitle>Description</span>
        <ui-input
          id="scenario-desc"
          label=""
          placeholder="Description"
          [value]="store.description()"
          (valueChange)="store.setDescription($event)"
        />
      </ui-collapsible-panel>

      <input #fileInput type="file" accept=".json" style="display: none" (change)="onFileSelected($event)" />
    </div>
  `,
})
export class ScenarioBuilderActionsComponent {
  protected readonly store = inject(ScenarioBuilderStore);
  protected readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly viewMode = input.required<'global' | 'walkthrough'>();
  readonly isDirty = input(false);

  readonly onSave = output<void>();
  readonly onSaveAsCopy = output<void>();
  readonly onToggleView = output<void>();

  protected exportJson(): void {
    const title = this.store.title() || 'scenario';
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const blob = exportScenarioToJson(
      this.store.title(),
      this.store.description(),
      this.store.content(),
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const result = parseScenarioImport(text);
      if (!result) {
        this.store.setError("Invalid scenario JSON file.");
        return;
      }
      this.store.loadImport(result.title, result.description, result.content);
    });
    input.value = "";
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder-view-actions.ts
git commit -m "feat(tfc): add scenario builder action bar component"
```

---

## Task 13: Rewrite Main View Layout (scenario-builder-view.ts)

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder-view.ts`

- [ ] **Step 1: Rewrite the full component**

Replace the entire file content:

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import {
  ButtonDirective,
  CollapsiblePanelComponent,
  SidebarLayoutComponent,
} from "@aspect/ui";
import { ScenarioApiService } from "../../core/scenario-api.service";
import { ScenarioBuilderStore } from "./scenario-builder.store";
import { ScenarioBuilderActionsComponent } from "./scenario-builder-view-actions";
import { ScenarioEventEditorComponent } from "./scenario-event-editor";
import { ScenarioIssueEditorComponent } from "./scenario-issue-editor";
import { ScenarioDecisionEditorComponent } from "./scenario-decision-editor";
import { ScenarioRolesEditorComponent } from "./scenario-roles-editor";
import { ScenarioSettingsEditorComponent } from "./scenario-settings-editor";
import { ScenarioSidebarNavComponent } from "./scenario-sidebar-nav";
import type { SidebarSection } from "./scenario-sidebar-nav";
import { ScenarioTurnsPlaceholderComponent } from "./scenario-turns-placeholder";
import { ScenarioWalkthroughComponent } from "./scenario-walkthrough";
import { validateScenarioContent } from "./validate-scenario-content";

@Component({
  selector: "tfc-scenario-builder-view",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ScenarioBuilderStore],
  imports: [
    ButtonDirective,
    CollapsiblePanelComponent,
    SidebarLayoutComponent,
    ScenarioBuilderActionsComponent,
    ScenarioEventEditorComponent,
    ScenarioIssueEditorComponent,
    ScenarioDecisionEditorComponent,
    ScenarioRolesEditorComponent,
    ScenarioSettingsEditorComponent,
    ScenarioSidebarNavComponent,
    ScenarioTurnsPlaceholderComponent,
    ScenarioWalkthroughComponent,
  ],
  template: `
    <ui-sidebar-layout side="left" style="--sidebar-width: 14rem; height: 100%">
      <div sidebar class="flex flex-col gap-md p-sm" style="height: 100%; overflow-y: auto">
        <tfc-scenario-sidebar-nav
          [sections]="sidebarSections()"
          [activeSection]="''"
        />
        <ui-collapsible-panel>
          <span panelTitle>Existing Scenarios</span>
          @for (s of scenarios(); track s.id) {
            <div class="flex items-center justify-between p-sm border-b">
              <span class="text-sm font-medium cursor-pointer" (click)="loadScenario(s.id)">
                {{ s.title }}
              </span>
              <button uiButton variant="destructive" size="sm" (click)="deleteScenario(s.id)">
                Delete
              </button>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">No scenarios found.</p>
          }
        </ui-collapsible-panel>
      </div>

      <div class="flex flex-col gap-md p-lg" style="overflow-y: auto">
        <tfc-scenario-builder-actions
          [viewMode]="viewMode()"
          [isDirty]="isDirty()"
          (onSave)="save()"
          (onSaveAsCopy)="saveAsCopy()"
          (onToggleView)="viewMode.set(viewMode() === 'global' ? 'walkthrough' : 'global')"
        />

        @if (store.error()) {
          <div class="p-sm border border-destructive bg-destructive/10 text-destructive text-sm rounded" role="alert">
            <strong>Validation errors:</strong>
            <ul class="mt-xs ml-md list-disc">
              @for (err of store.error()!.split('\\n'); track err) {
                <li>{{ err }}</li>
              }
            </ul>
          </div>
        }

        @if (viewMode() === 'global') {
          <section id="section-roles" style="scroll-margin-top: var(--spacing-xl)">
            <tfc-scenario-roles-editor />
          </section>
          <section id="section-events" style="scroll-margin-top: var(--spacing-xl)">
            <tfc-scenario-event-editor />
          </section>
          <section id="section-issues" style="scroll-margin-top: var(--spacing-xl)">
            <tfc-scenario-issue-editor />
          </section>
          <section id="section-decisions" style="scroll-margin-top: var(--spacing-xl)">
            <tfc-scenario-decision-editor />
          </section>
          <section id="section-turns" style="scroll-margin-top: var(--spacing-xl)">
            <tfc-scenario-turns-placeholder />
          </section>
          <section id="section-settings" style="scroll-margin-top: var(--spacing-xl)">
            <tfc-scenario-settings-editor />
          </section>
        } @else {
          <tfc-scenario-walkthrough />
        }
      </div>
    </ui-sidebar-layout>
  `,
})
export class ScenarioBuilderView implements OnInit {
  protected readonly store = inject(ScenarioBuilderStore);
  private readonly api = inject(ScenarioApiService);
  protected readonly scenarios = signal<{ id: number; title: string }[]>([]);

  protected readonly viewMode = signal<'global' | 'walkthrough'>('global');

  protected readonly isDirty = computed(() => {
    const snap = this.store.loadedSnapshot();
    if (!snap) return false;
    const current = JSON.stringify({
      title: this.store.title(),
      description: this.store.description(),
      content: this.store.content(),
    });
    return current !== snap;
  });

  protected readonly sidebarSections = computed<SidebarSection[]>(() => {
    const c = this.store.content();
    return [
      { id: 'roles', label: 'Roles', count: (c.roles ?? []).length },
      { id: 'events', label: 'Events', count: c.events.length },
      { id: 'issues', label: 'Issues', count: c.issues.length },
      { id: 'decisions', label: 'Decisions', count: c.decision_templates.length },
      { id: 'turns', label: 'Turns', count: (c.turns ?? []).length },
      { id: 'settings', label: 'Settings', count: 0 },
    ];
  });

  ngOnInit(): void {
    this.loadList();
  }

  private loadList(): void {
    this.api.list().subscribe({
      next: (list) => this.scenarios.set(list.map((s) => ({ id: s.id, title: s.title }))),
    });
  }

  protected loadScenario(id: number): void {
    this.api.get(id).subscribe({
      next: (s) => this.store.loadScenario(s.id, s.title, s.description, s.content),
    });
  }

  protected save(): void {
    this.store.clearError();
    const content = this.store.content();
    const errors = validateScenarioContent(content);
    if (!this.store.title().trim()) errors.unshift("Title is required.");
    if (errors.length > 0) {
      this.store.setError(errors.join("\n"));
      return;
    }
    this.store.setSaving(true);
    const payload = { title: this.store.title(), description: this.store.description(), content };
    const id = this.store.scenarioId();
    const req = id ? this.api.update(id, payload) : this.api.create(payload);
    req.subscribe({
      next: (s) => {
        this.store.loadScenario(s.id, s.title, s.description, s.content);
        this.store.setSaving(false);
        this.loadList();
      },
      error: () => this.store.setError("Save failed — server rejected the scenario."),
    });
  }

  protected saveAsCopy(): void {
    const id = this.store.scenarioId();
    if (!id) return;
    this.store.setSaving(true);
    this.api.clone(id).subscribe({
      next: (s) => {
        this.store.loadScenario(s.id, s.title, s.description, s.content);
        this.store.setSaving(false);
        this.loadList();
      },
      error: () => {
        this.store.setSaving(false);
        this.store.setError("Clone failed.");
      },
    });
  }

  protected deleteScenario(id: number): void {
    this.api.delete(id).subscribe({ next: () => this.loadList() });
  }
}
```

- [ ] **Step 2: Verify line count is under 350**

Run: `wc -l apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder-view.ts`
Expected: ~175 lines (well under 350)

- [ ] **Step 3: Verify compilation**

Run: `cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | head -20`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder-view.ts
git commit -m "feat(tfc): rewrite scenario builder with sidebar layout, action bar, and view toggle"
```

---

## Task 14: Cross-Reference Chips in Event/Issue Editors

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-event-editor.ts`
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-issue-editor.ts`

- [ ] **Step 1: Add cross-reference chips to event editor collapsed view**

In `scenario-event-editor.ts`, in the `@else` (collapsed) branch, after the time display, add:

```html
@for (issueId of event.triggered_issues; track issueId) {
  <span
    class="text-xs cursor-pointer"
    style="text-decoration: underline dotted; color: var(--color-primary)"
    (click)="scrollTo('issue-' + issueId); $event.stopPropagation()"
  >{{ issueId }}</span>
}
```

Add `scrollTo` method:

```typescript
protected scrollTo(elementId: string): void {
  document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
```

Add `id` attribute to each event row: `[id]="'event-' + event.id"`

- [ ] **Step 2: Add cross-reference chip to issue editor collapsed view**

In `scenario-issue-editor.ts`, in the collapsed branch, after auto-resolve display, add:

```html
@if (issue.trigger_event_id) {
  <span
    class="text-xs cursor-pointer"
    style="text-decoration: underline dotted; color: var(--color-primary)"
    (click)="scrollTo('event-' + issue.trigger_event_id); $event.stopPropagation()"
  >{{ issue.trigger_event_id }}</span>
}
```

Add `scrollTo` method (same as above).

Add `id` attribute to each issue row: `[id]="'issue-' + issue.id"`

- [ ] **Step 3: Verify compilation**

Run: `cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add apps/tfc/frontend/src/app/features/scenario-builder/scenario-event-editor.ts apps/tfc/frontend/src/app/features/scenario-builder/scenario-issue-editor.ts
git commit -m "feat(tfc): add cross-reference chips to event and issue editors"
```

---

## Task 15: Update E2E Tests

**Files:**
- Modify: `apps/tfc/frontend/e2e/tests/scenario-builder.spec.ts`

- [ ] **Step 1: Update existing tests for new layout**

Update selectors for the sidebar layout. Title input is now in the action bar, not a separate form row.

- [ ] **Step 2: Add new test cases**

```typescript
test("sidebar navigation is visible", async ({ page }) => {
  await page.goto("/scenario-builder");
  await expect(page.locator("tfc-scenario-sidebar-nav")).toBeVisible();
});

test("view toggle switches between global and walkthrough", async ({ page }) => {
  await page.goto("/scenario-builder");
  const toggleBtn = page.getByRole("button", { name: "Walkthrough" });
  await expect(toggleBtn).toBeVisible();
  await toggleBtn.click();
  await expect(page.locator("tfc-scenario-walkthrough")).toBeVisible();
});

test("export button is visible", async ({ page }) => {
  await page.goto("/scenario-builder");
  await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
});
```

- [ ] **Step 3: Run e2e tests**

Run: `cd apps/tfc/frontend && npx playwright test e2e/tests/scenario-builder.spec.ts`

- [ ] **Step 4: Commit**

```bash
git add apps/tfc/frontend/e2e/tests/scenario-builder.spec.ts
git commit -m "test(tfc): update scenario builder e2e tests for new layout"
```

---

## Task 16: Final Verification

- [ ] **Step 1: Run full frontend build**

Run: `cd apps/tfc/frontend && npx ng build`

- [ ] **Step 2: Run all frontend unit tests**

Run: `cd apps/tfc/frontend && npx vitest run`

- [ ] **Step 3: Run backend scenario tests**

Run: `cd apps/tfc/backend && python -m pytest features/scenario/ -v`

- [ ] **Step 4: Run full validation**

Run: `make validate` (from repo root)

- [ ] **Step 5: Final commit if any fixups needed**
