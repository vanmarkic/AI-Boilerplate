# Player Board Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the player view's two-column + modal layout with a flat card grid for solo/2-player modes, where each role gets one combined card (intel + decision form).

**Architecture:** Conditional rendering in `player-view.html` — multi-role modes get the new board layout, single-role modes keep the existing layout. A new `RoleCardComponent` renders combined intel + decision per role. A new `roleCards()` computed signal in `player-view.ts` merges event data with decision data to build the card array.

**Tech Stack:** Angular 21 (standalone components, signals, zoneless), @ngrx/signals store, @aspect/ui components, @aspect/design-system CSS tokens.

**Spec:** `docs/superpowers/specs/2026-03-19-player-board-layout-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/tfc/frontend/src/app/features/player/role-card.types.ts` | Create | `RoleCard` interface and `buildRoleCards()` pure function |
| `apps/tfc/frontend/src/app/features/player/role-card.component.ts` | Create | Combined role card: intel section + decision form + submission |
| `apps/tfc/frontend/src/app/features/player/player-view.ts` | Modify | Add `roleCards()` and `currentTurnEvent()` computed signals, add `onRoleCardSubmitted()` handler |
| `apps/tfc/frontend/src/app/features/player/player-view.html` | Modify | Conditional template: `isMultiRole()` → board layout, else → existing layout |
| `apps/tfc/frontend/src/app/features/player/player-decision-handlers.ts` | Unchanged | Existing `submitRoleRecommendation` and `submitDecision` reused as-is |
| `apps/tfc/frontend/src/app/shared/components-player-view.css` | Modify | Add CSS for `.board-grid`, `.board-turn-banner`, `.role-card`, `.role-card--intel`, `.role-card--active`, `.role-card--done` |

**Not modified:** Multi-player template path, `DecisionPanelComponent` (already converted to inline card, still used in single-role mode), `AllAdvisorsPanelComponent` (still used in single-role collaborative mode).

---

### Task 1: RoleCard Interface and Builder Function

**Files:**
- Create: `apps/tfc/frontend/src/app/features/player/role-card.types.ts`

This is the core data transformation: merging events + decisions + roles into a flat card array.

- [ ] **Step 1: Create the RoleCard interface and buildRoleCards function**

```typescript
// apps/tfc/frontend/src/app/features/player/role-card.types.ts
import type { ActiveDecision, DecisionOption } from "../../core/decision-api.service";
import type { RoleDef } from "../../core/scenario-api.service";
import type { EventSnapshot } from "../../core/generated/state-changes.types";

export interface AdvisorRec {
  roleId: string;
  roleLabel: string;
  selection: string | null; // option label, or null if pending
}

export interface RoleCard {
  roleId: string;
  roleLabel: string;
  playerType: "decision_maker" | "advisor";
  intel: string | null;
  decision: ActiveDecision | null;
  status: "intel" | "active" | "done";
  advisorRecs: AdvisorRec[];
}

export function buildRoleCards(
  roles: RoleDef[],
  event: EventSnapshot | null,
  decision: ActiveDecision | null,
  submittedRoles: Set<string>,
  showDecisionMaker: boolean,
): RoleCard[] {
  if (!event && !decision) return [];
  const roleDescs = event?.role_descriptions ?? {};
  const targetRoles = decision?.target_roles ?? [];
  const decisionMakerRole = roles.find(
    (r) => r.player_type === "decision_maker",
  );

  return roles
    .filter((role) => {
      if (
        role.player_type === "decision_maker" &&
        !showDecisionMaker
      )
        return false;
      const hasIntel = roleDescs[role.id] != null;
      const hasDecision = targetRoles.includes(role.id);
      return hasIntel || hasDecision;
    })
    .map((role) => {
      const hasDecision = targetRoles.includes(role.id);
      const isDone = hasDecision && submittedRoles.has(role.id);
      const advisorRecs: AdvisorRec[] = [];

      if (role.player_type === "decision_maker" && decision) {
        const advisorTargets = targetRoles.filter(
          (rid) => rid !== role.id,
        );
        for (const advisorRoleId of advisorTargets) {
          const advisorRole = roles.find((r) => r.id === advisorRoleId);
          const recEntry = Object.entries(
            decision.recommendations || {},
          ).find(([key]) => {
            const colonIdx = key.indexOf(":");
            return colonIdx !== -1
              ? key.slice(colonIdx + 1) === advisorRoleId
              : key === advisorRoleId;
          });
          const optionId = recEntry?.[1] ?? null;
          const optionLabel = optionId
            ? (decision.options.find((o) => o.id === optionId)?.label ??
                optionId)
            : null;
          advisorRecs.push({
            roleId: advisorRoleId,
            roleLabel: advisorRole?.label ?? advisorRoleId,
            selection: optionLabel,
          });
        }
      }

      return {
        roleId: role.id,
        roleLabel: role.label,
        playerType: role.player_type as "decision_maker" | "advisor",
        intel: roleDescs[role.id] ?? null,
        decision: hasDecision ? decision : null,
        status: hasDecision ? (isDone ? "done" : "active") : "intel",
        advisorRecs,
      } satisfies RoleCard;
    });
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd apps/tfc/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/features/player/role-card.types.ts
git commit -m "feat(tfc): add RoleCard interface and buildRoleCards builder"
```

---

### Task 2: RoleCardComponent

**Files:**
- Create: `apps/tfc/frontend/src/app/features/player/role-card.component.ts`

Renders a single combined role card: role header with badge, intel section, decision form (if targeted), advisor recs (if CO), done state.

- [ ] **Step 1: Create the component**

```typescript
// apps/tfc/frontend/src/app/features/player/role-card.component.ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from "@angular/core";
import { UpperCasePipe } from "@angular/common";
import { BadgeComponent, ButtonDirective } from "@aspect/ui";
import type { RoleCard } from "./role-card.types";
import type { DecisionOption } from "../../core/decision-api.service";

export interface RoleCardSubmission {
  roleId: string;
  selectedOptions: string[];
  freeText: string;
}

@Component({
  selector: "tfc-role-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ButtonDirective, UpperCasePipe],
  // NOTE: Options are filtered per role. Advisor cards see COMMON + own role options.
  // CO card sees ALL options. See filteredOptions() computed signal.
  template: `
    <div
      class="role-card"
      [class.role-card--intel]="card().status === 'intel'"
      [class.role-card--active]="card().status === 'active'"
      [class.role-card--done]="card().status === 'done'"
    >
      <!-- Header -->
      <div class="role-card__header">
        <span class="role-card__role-id">{{ card().roleId | uppercase }}</span>
        <ui-badge
          [variant]="card().status === 'active' ? 'default' : 'secondary'"
        >
          {{ badgeLabel() }}
        </ui-badge>
      </div>
      <div class="role-card__role-label">{{ card().roleLabel }}</div>

      <!-- Intel -->
      @if (card().intel) {
        <div class="role-card__intel">{{ card().intel }}</div>
      } @else if (card().decision) {
        <div class="role-card__intel role-card__intel--empty">
          No role-specific intel this turn
        </div>
      }

      <!-- Advisor Recs (CO card only) -->
      @if (card().advisorRecs.length > 0) {
        <div class="role-card__recs">
          <div class="role-card__recs-title">Advisor Recommendations</div>
          @for (rec of card().advisorRecs; track rec.roleId) {
            <div
              class="role-card__rec"
              [class.role-card__rec--pending]="!rec.selection"
            >
              <span class="role-card__rec-role">{{ rec.roleLabel }}:</span>
              @if (rec.selection) {
                <span class="role-card__rec-selection">{{
                  rec.selection
                }}</span>
              } @else {
                <span class="role-card__rec-pending">pending...</span>
              }
            </div>
          }
        </div>
      }

      <!-- Decision Form (active only) -->
      @if (card().decision && card().status === 'active') {
        <div class="role-card__decision">
          <div class="role-card__decision-question">
            {{ card().decision!.description }}
          </div>
          @if (questionType() === 'single_choice' || questionType() === 'multi_choice') {
            @for (option of filteredOptions(); track option.id) {
              <label
                class="role-card__option"
                [class.role-card__option--selected]="
                  isSelected(option.id)
                "
              >
                <input
                  [type]="questionType() === 'single_choice' ? 'radio' : 'checkbox'"
                  [name]="'role-decision-' + card().roleId"
                  [checked]="isSelected(option.id)"
                  (change)="toggleOption(option)"
                />
                <span>{{ option.label }}</span>
              </label>
            }
          }
          @if (questionType() === 'free_text') {
            <textarea
              class="role-card__textarea"
              [value]="freeText()"
              (input)="onTextInput($event)"
              placeholder="Enter your response..."
            ></textarea>
          }
          <div class="role-card__actions">
            <button
              uiButton
              variant="default"
              size="sm"
              (click)="onSubmit()"
              [disabled]="!canSubmit()"
            >
              Submit
            </button>
          </div>
        </div>
      }

      <!-- Done State -->
      @if (card().status === 'done') {
        <div class="role-card__done">
          Selected: {{ doneLabel() }}
        </div>
      }
    </div>
  `,
})
export class RoleCardComponent {
  readonly card = input.required<RoleCard>();
  readonly submitted = output<RoleCardSubmission>();

  protected readonly selectedOptions = signal<string[]>([]);
  protected readonly freeText = signal("");

  /** Advisor cards see COMMON + own-role options. CO sees ALL options. */
  protected readonly filteredOptions = computed(() => {
    const card = this.card();
    const allOptions = card.decision?.options ?? [];
    if (card.playerType === "decision_maker") return allOptions;
    return allOptions.filter(
      (o) => !o.role || o.role === card.roleId,
    );
  });

  protected readonly badgeLabel = computed(() => {
    switch (this.card().status) {
      case "intel":
        return "INTEL";
      case "active":
        return "DECISION";
      case "done":
        return "DONE";
    }
  });

  protected readonly questionType = computed(
    () => this.card().decision?.question_type ?? "free_text",
  );

  protected readonly doneLabel = computed(() => {
    const card = this.card();
    if (!card.decision) return "";
    const recs = card.decision.recommendations || {};
    const myRec = Object.entries(recs).find(([key]) => {
      const colonIdx = key.indexOf(":");
      return colonIdx !== -1
        ? key.slice(colonIdx + 1) === card.roleId
        : key === card.roleId;
    });
    if (!myRec) return "Submitted";
    const option = card.decision.options.find((o) => o.id === myRec[1]);
    return option?.label ?? myRec[1];
  });

  protected isSelected(optionId: string): boolean {
    return this.selectedOptions().includes(optionId);
  }

  protected toggleOption(option: DecisionOption): void {
    const qt = this.questionType();
    if (qt === "single_choice") {
      this.selectedOptions.set([option.id]);
    } else {
      const current = this.selectedOptions();
      if (current.includes(option.id)) {
        this.selectedOptions.set(current.filter((id) => id !== option.id));
      } else {
        this.selectedOptions.set([...current, option.id]);
      }
    }
  }

  protected onTextInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      this.freeText.set(target.value);
    }
  }

  protected canSubmit(): boolean {
    if (this.questionType() === "free_text")
      return this.freeText().trim().length > 0;
    return this.selectedOptions().length > 0;
  }

  protected onSubmit(): void {
    this.submitted.emit({
      roleId: this.card().roleId,
      selectedOptions: this.selectedOptions(),
      freeText: this.freeText(),
    });
  }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd apps/tfc/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/features/player/role-card.component.ts
git commit -m "feat(tfc): add RoleCardComponent for combined intel + decision cards"
```

---

### Task 3: Add Computed Signals to player-view.ts

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/player/player-view.ts`
- Modify: `apps/tfc/frontend/src/app/features/player/player-decision-handlers.ts`

Add `currentTurnEvent()`, `roleCards()`, `submittedRoles` signal, and the `onRoleCardSubmitted()` handler.

- [ ] **Step 1: Add RoleCardComponent import and submittedRoles signal to player-view.ts**

In `player-view.ts`, add these imports at the top:

```typescript
import { RoleCardComponent } from "./role-card.component";
import type { RoleCardSubmission } from "./role-card.component";
import { buildRoleCards } from "./role-card.types";
```

Add `RoleCardComponent` to the `imports` array in the `@Component` decorator.

Add this signal to the class:

```typescript
protected readonly submittedRoles = signal<Set<string>>(new Set());
```

- [ ] **Step 2: Add currentTurnEvent() computed signal**

Add after the `isMultiRole` computed:

```typescript
protected readonly currentTurnEvent = computed(() => {
  const decisions = this.activeDecisions();
  if (decisions.length === 0) return null;
  const decision = decisions[0];
  if (!decision.event_id) return null;
  return this.store.events().find((e) => e.id === decision.event_id) ?? null;
});
```

- [ ] **Step 3: Add roleCards() computed signal**

Add after `currentTurnEvent`:

```typescript
protected readonly roleCards = computed(() => {
  const roles = this.store.context()?.roles ?? [];
  const event = this.currentTurnEvent();
  const decision = this.activeDecisions()[0] ?? null;
  const role = this.store.playerRole();
  const showDecisionMaker =
    role === "all_roles" || role === "solo_player" || this.store.isPracticeMode();
  return buildRoleCards(roles, event, decision, this.submittedRoles(), showDecisionMaker);
});
```

- [ ] **Step 4: Add onRoleCardSubmitted handler**

Add to the class:

```typescript
protected onRoleCardSubmitted(submission: RoleCardSubmission): void {
  const decision = this.activeDecisions()[0];
  if (!decision) return;
  const role = this.store.context()?.roles?.find(
    (r) => r.id === submission.roleId,
  );
  if (role?.player_type === "decision_maker") {
    submitDecision(
      this.decisionApi,
      this.store,
      this.exerciseId(),
      decision,
      this.participantId(),
      submission,
    );
  } else {
    submitRoleRecommendation(
      this.decisionApi,
      this.exerciseId(),
      decision,
      this.participantId(),
      { roleId: submission.roleId, ...submission },
    );
  }
  const updated = new Set(this.submittedRoles());
  updated.add(submission.roleId);
  this.submittedRoles.set(updated);
}
```

- [ ] **Step 5: Add effect to reset submittedRoles on new decision**

Add to the class:

```typescript
private readonly resetSubmittedRolesEffect = effect(() => {
  const decision = this.activeDecisions()[0];
  const id = decision?.id ?? null;
  // Track decision ID changes to clear submitted state
  if (id) {
    this.submittedRoles.set(new Set());
  }
});
```

- [ ] **Step 6: Verify it compiles**

Run: `cd apps/tfc/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add apps/tfc/frontend/src/app/features/player/player-view.ts
git commit -m "feat(tfc): add roleCards computed signal and board submission handler"
```

---

### Task 4: Board Layout Template

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/player/player-view.html`

Replace the `<main>` section with a conditional: `isMultiRole()` renders the board layout, otherwise keeps the existing layout. The board layout has: turn banner, role card grid, and no side panels.

- [ ] **Step 1: Wrap existing main content in an else branch**

Replace the entire `<main class="player-main">` block (lines 21–121 of the current template) and the decision panel section (lines 125–190) with:

```html
  @if (isMultiRole()) {
    <!-- Board Layout (solo / 2-player) -->
    <main class="player-main">
      <!-- Turn Banner -->
      @if (currentTurnEvent(); as event) {
        <div class="board-turn-banner">
          @if (store.score(); as score) {
            <div class="board-turn-banner__turn">TURN {{ score.turnNumber }}</div>
          }
          <div class="board-turn-banner__title">{{ event.title }}</div>
          <div class="board-turn-banner__desc">{{ event.description }}</div>
        </div>
      } @else {
        <div class="board-turn-banner">
          <div class="board-turn-banner__title">Waiting for next turn...</div>
        </div>
      }

      <!-- Role Card Grid -->
      <div class="board-grid">
        @for (card of roleCards(); track card.roleId) {
          <tfc-role-card
            [card]="card"
            (submitted)="onRoleCardSubmitted($event)"
          />
        }
      </div>
    </main>
  } @else {
    <!-- Classic Layout (multi-player / single-role) -->
    <main class="player-main">
      <!-- [existing main content from lines 22–120 goes here unchanged] -->
    </main>

    <!-- [existing decision panel section from lines 125–190 goes here unchanged] -->
  }
```

Keep the header, turn banner component (for classic mode), score bar, briefing overlay, and footer outside the conditional — they are shared.

**Important:** The existing `<main>` block and the decision panel block (lines 21–190) must be moved inside the `@else` branch verbatim. Do NOT delete any existing template code — just wrap it.

- [ ] **Step 2: Verify it compiles and renders**

Run: `cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/features/player/player-view.html
git commit -m "feat(tfc): add conditional board layout template for multi-role modes"
```

---

### Task 5: Board CSS

**Files:**
- Modify: `apps/tfc/frontend/src/app/shared/components-player-view.css`

Add styles for the board turn banner, card grid, and role card states. Use existing design tokens.

- [ ] **Step 1: Add board layout CSS**

Append the following to the end of `components-player-view.css`, inside the existing `@layer components` block (before the closing `}`):

```css
  /* ── Board Layout (solo / 2-player) ────────────────── */

  .board-turn-banner {
    text-align: center;
    padding: var(--spacing-lg) var(--spacing-md);
    border-bottom: 1px solid var(--color-border);
  }
  .board-turn-banner__turn {
    font-family: var(--font-mono);
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--color-foreground);
    letter-spacing: 0.05em;
  }
  .board-turn-banner__title {
    font-size: var(--font-size-md);
    color: var(--color-muted-foreground);
    margin-top: var(--spacing-xs);
  }
  .board-turn-banner__desc {
    font-size: var(--font-size-sm);
    color: var(--color-muted-foreground);
    margin-top: var(--spacing-sm);
    max-width: 40rem;
    margin-inline: auto;
    line-height: 1.5;
  }

  .board-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-md);
    padding: var(--spacing-md) var(--spacing-lg);
  }

  /* ── Role Card ─────────────────────────────────────── */

  .role-card {
    flex: 1 1 14rem;
    max-width: 22rem;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-md);
    border-radius: 2px;
    background: var(--color-card);
    border: 1px solid var(--color-border);
    transition: box-shadow 200ms ease, border-color 200ms ease, opacity 200ms ease;
  }
  .role-card--intel {
    border-left: 3px solid var(--color-primary);
  }
  .role-card--active {
    border: 2px solid var(--color-success);
    background: oklch(15% 0.04 160);
  }
  .role-card--done {
    border: 1px solid var(--color-muted);
    opacity: 0.7;
  }

  .role-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-2xs);
  }
  .role-card__role-id {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--color-primary);
  }
  .role-card--active .role-card__role-id {
    color: var(--color-success);
  }
  .role-card__role-label {
    font-size: var(--font-size-xs);
    color: var(--color-muted-foreground);
    font-style: italic;
    margin-bottom: var(--spacing-sm);
  }

  .role-card__intel {
    font-size: var(--font-size-sm);
    color: var(--color-foreground);
    line-height: 1.5;
    margin-bottom: var(--spacing-sm);
  }
  .role-card__intel--empty {
    color: var(--color-muted-foreground);
    font-style: italic;
  }

  /* ── Advisor Recs (CO card) ────────────────────────── */

  .role-card__recs {
    margin-bottom: var(--spacing-sm);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2xs);
  }
  .role-card__recs-title {
    font-size: var(--font-size-xs);
    color: var(--color-primary);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--spacing-2xs);
  }
  .role-card__rec {
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--color-card);
    border-radius: 2px;
    border-left: 2px solid var(--color-primary);
    font-size: var(--font-size-xs);
  }
  .role-card__rec--pending {
    border-left-style: dashed;
    border-left-color: var(--color-muted);
  }
  .role-card__rec-role {
    color: var(--color-primary);
    font-weight: 600;
  }
  .role-card__rec-selection {
    color: var(--color-muted-foreground);
  }
  .role-card__rec-pending {
    color: var(--color-muted);
    font-style: italic;
  }

  /* ── Decision Form ─────────────────────────────────── */

  .role-card__decision {
    border-top: 1px solid var(--color-success);
    padding-top: var(--spacing-sm);
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }
  .role-card__decision-question {
    font-size: var(--font-size-xs);
    color: var(--color-success);
    font-weight: 600;
    margin-bottom: var(--spacing-2xs);
  }
  .role-card__option {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid var(--color-border);
    border-radius: 2px;
    cursor: pointer;
    font-size: var(--font-size-xs);
    color: var(--color-foreground);
    transition: background 150ms ease;
  }
  .role-card__option:hover {
    background: var(--color-secondary);
  }
  .role-card__option--selected {
    background: var(--color-secondary);
    border-color: var(--color-success);
  }
  .role-card__textarea {
    width: 100%;
    min-height: calc(var(--spacing-xl) * 2);
    padding: var(--spacing-xs);
    border: 1px solid var(--color-border);
    border-radius: 2px;
    background: var(--color-input);
    color: var(--color-foreground);
    font-size: var(--font-size-xs);
    font-family: inherit;
    resize: vertical;
  }
  .role-card__textarea:focus {
    outline: 2px solid var(--color-ring);
    outline-offset: 1px;
  }
  .role-card__actions {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--spacing-xs);
  }

  .role-card__done {
    border-top: 1px solid var(--color-muted);
    padding-top: var(--spacing-xs);
    margin-top: auto;
    font-size: var(--font-size-xs);
    color: var(--color-muted-foreground);
  }
```

- [ ] **Step 2: Verify CSS loads without errors**

Run: `cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/shared/components-player-view.css
git commit -m "style(tfc): add board layout and role card CSS"
```

---

### Task 6: Manual Smoke Test

**Files:** None (verification only)

- [ ] **Step 1: Start the dev server**

Run: `cd apps/tfc && make dev` (or however the dev server starts)

- [ ] **Step 2: Open the player URL in practice mode**

Navigate to: `http://localhost:4201/player?exerciseId=1&participantId=test&role=all_roles&gameMode=simple_collaborative&practiceMode=true`

- [ ] **Step 3: Verify board layout**

Check:
- Turn banner shows turn number, event title, event description
- Role cards appear in scenario role order
- Cards with decision targeting show green border + decision form
- Intel-only cards show cyan left border + role description
- CO card shows "Advisor Recommendations" section with pending entries
- Submitting an advisor card transitions it to "done" state (faded)
- Submitted advisor selection appears on CO card
- Submitting CO card closes the decision and advances the turn
- New turn shows clean slate with new cards

- [ ] **Step 4: Verify classic layout still works**

Navigate to: `http://localhost:4201/player?exerciseId=1&participantId=test&role=ops&gameMode=simple_collaborative`

Check: Old two-column layout renders as before (no regression).

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -u
git commit -m "fix(tfc): address smoke test issues in board layout"
```
