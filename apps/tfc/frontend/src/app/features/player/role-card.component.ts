import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from "@angular/core";
import { UpperCasePipe } from "@angular/common";
import { BadgeComponent, ButtonDirective } from "@aspect/ui";
import type { DecisionOption } from "../../core/decision-api.service";
import type { SystemSnapshot } from "../../core/generated/state-changes.types";
import { extractRecRoleId, type RoleCard } from "./role-card.types";

export interface RoleCardSubmission {
  roleId: string;
  selectedOptions: string[];
  freeText: string;
  targetSystemSelections: Record<string, string>;
}

@Component({
  selector: "tfc-role-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UpperCasePipe, BadgeComponent, ButtonDirective],
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

      <!-- Decision Form (active only, interactive) -->
      @if (card().decision && card().status === "active" && !readonly()) {
        <div class="role-card__decision">
          @if (
            questionType() === "single_choice" ||
            questionType() === "multi_choice"
          ) {
            @for (option of filteredOptions(); track option.id) {
              <label
                class="role-card__option"
                [class.role-card__option--selected]="isSelected(option.id)"
              >
                <input
                  [type]="
                    questionType() === 'single_choice' ? 'radio' : 'checkbox'
                  "
                  [name]="'role-decision-' + card().roleId"
                  [checked]="isSelected(option.id)"
                  (change)="toggleOption(option)"
                />
                <span>{{ option.label }}</span>
                @if (option.description) {
                  <span class="role-card__option-desc">{{ option.description }}</span>
                }
                @if (option.targets_system && isSelected(option.id)) {
                  <select
                    class="role-card__system-picker"
                    [value]="targetSystemSelections()[option.id] || ''"
                    (change)="onSystemSelect(option.id, $event)"
                  >
                    <option value="">Select system...</option>
                    @for (sys of systems(); track sys.system_id) {
                      <option [value]="sys.system_id">{{ sys.label }}</option>
                    }
                  </select>
                }
              </label>
            }
          }
          @if (questionType() === "free_text") {
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

      <!-- Decision Mirror (readonly, CO view) -->
      @if (card().decision && card().status === "active" && readonly()) {
        <div class="role-card__decision">
          @for (option of filteredOptions(); track option.id) {
            <div
              class="role-card__option"
              [class.role-card__option--selected]="isRecommended(option.id)"
            >
              <span>{{ option.label }}</span>
              @if (isRecommended(option.id)) {
                <span class="role-card__rec-check">✓</span>
              }
            </div>
          }
          @if (pendingLabel()) {
            <div class="role-card__done role-card__done--pending">
              {{ pendingLabel() }}
            </div>
          }
        </div>
      }

      <!-- Done State -->
      @if (card().status === "done") {
        <div class="role-card__done">Selected: {{ doneLabel() }}</div>
      }
    </div>
  `,
})
export class RoleCardComponent {
  readonly card = input.required<RoleCard>();
  readonly systems = input<SystemSnapshot[]>([]);
  readonly readonly = input(false);
  readonly submitted = output<RoleCardSubmission>();

  readonly selectedOptions = signal<string[]>([]);
  readonly freeText = signal("");
  readonly targetSystemSelections = signal<Record<string, string>>({});

  private readonly resetOnCardChange = effect(() => {
    this.card();
    untracked(() => {
      this.selectedOptions.set([]);
      this.freeText.set("");
      this.targetSystemSelections.set({});
    });
  });

  readonly filteredOptions = computed<DecisionOption[]>(() => {
    const decision = this.card().decision;
    if (!decision) return [];
    const playerType = this.card().playerType;
    const roleId = this.card().roleId;
    if (playerType === "decision_maker") {
      return decision.options;
    }
    // advisor: COMMON options (no role) + own-role options
    return decision.options.filter((o) => !o.role || o.role === roleId);
  });

  readonly badgeLabel = computed<string>(() => {
    const status = this.card().status;
    if (status === "intel") return "INTEL";
    if (status === "active") return "DECISION";
    return "DONE";
  });

  readonly questionType = computed<string>(() => {
    return this.card().decision?.question_type ?? "free_text";
  });

  readonly doneLabel = computed<string>(() => {
    const decision = this.card().decision;
    if (!decision) return "";
    const roleId = this.card().roleId;
    const recEntry = Object.entries(decision.recommendations).find(
      ([key]) => extractRecRoleId(key) === roleId,
    );
    const optionId = recEntry?.[1];
    if (!optionId) return "";
    return decision.options.find((o) => o.id === optionId)?.label ?? optionId;
  });

  readonly pendingLabel = computed(() => {
    if (!this.readonly()) return null;
    const recs = this.card().decision?.recommendations ?? {};
    const roleId = this.card().roleId;
    const hasRec = Object.keys(recs).some(
      (key) => extractRecRoleId(key) === roleId,
    );
    return hasRec ? null : "pending...";
  });

  protected isRecommended(optionId: string): boolean {
    const recs = this.card().decision?.recommendations ?? {};
    const roleId = this.card().roleId;
    return Object.entries(recs).some(
      ([key, val]) => extractRecRoleId(key) === roleId && val === optionId,
    );
  }

  protected isSelected(optionId: string): boolean {
    return this.selectedOptions().includes(optionId);
  }

  protected canSubmit(): boolean {
    if (this.questionType() === "free_text") {
      return this.freeText().trim().length > 0;
    }
    if (this.selectedOptions().length === 0) return false;
    const opts = this.filteredOptions();
    for (const optId of this.selectedOptions()) {
      const opt = opts.find((o) => o.id === optId);
      if (opt?.targets_system && !this.targetSystemSelections()[optId]) {
        return false;
      }
    }
    return true;
  }

  protected toggleOption(option: DecisionOption): void {
    if (this.questionType() === "single_choice") {
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

  protected onSystemSelect(optionId: string, event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;
    this.targetSystemSelections.update((prev) => ({
      ...prev,
      [optionId]: select.value,
    }));
  }

  protected onTextInput(event: Event): void {
    if (!(event.target instanceof HTMLTextAreaElement)) return;
    const textarea = event.target;
    this.freeText.set(textarea.value);
  }

  protected onSubmit(): void {
    this.submitted.emit({
      roleId: this.card().roleId,
      selectedOptions: this.selectedOptions(),
      freeText: this.freeText(),
      targetSystemSelections: this.targetSystemSelections(),
    });
  }
}
