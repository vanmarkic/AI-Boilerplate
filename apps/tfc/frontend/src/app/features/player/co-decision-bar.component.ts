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
import { ButtonDirective } from "@aspect/ui";
import type { ActiveDecision } from "../../core/decision-api.service";
import type { RoleDef } from "../../core/scenario-api.service";
import type { SystemSnapshot } from "../../core/generated/state-changes.types";
import { extractRecRoleId } from "./role-card.types";

export interface CoDecisionConfirmation {
  selectedOptionIds: string[];
  targetSystemSelections: Record<string, string>;
}

@Component({
  selector: "tfc-co-decision-bar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective],
  template: `
    @if (decision(); as d) {
      <div class="co-decision-bar">
        @if (coIntel()) {
          <div class="co-decision-bar__intel">{{ coIntel() }}</div>
        }
        <div class="co-decision-bar__options">
          @for (option of d.options; track option.id) {
            <div
              class="co-decision-bar__option"
              [class.co-decision-bar__option--selected]="isSelected(option.id)"
              [attr.data-recommended]="
                getRecommenders(option.id).length > 0 ? '' : null
              "
              (click)="toggleOption(option.id)"
            >
              <span class="co-decision-bar__option-label">{{
                option.label
              }}</span>
              @if (getRecommenders(option.id); as recs) {
                @if (recs.length > 0) {
                  <span class="co-decision-bar__rec-badge"
                    >★ {{ recs.join(", ") }}</span
                  >
                }
              }
              @if (option.targets_system && isSelected(option.id)) {
                <select
                  class="role-card__system-picker"
                  [value]="targetSystemSelections()[option.id] || ''"
                  (change)="onSystemSelect(option.id, $event)"
                  (click)="$event.stopPropagation()"
                >
                  <option value="">Select system...</option>
                  @for (sys of systems(); track sys.system_id) {
                    <option [value]="sys.system_id">{{ sys.label }}</option>
                  }
                </select>
              }
            </div>
          }
        </div>
        <button
          class="co-decision-bar__confirm"
          uiButton
          variant="default"
          [disabled]="!canConfirm()"
          (click)="onConfirm()"
        >
          Confirm
        </button>
      </div>
    } @else {
      <div class="co-decision-bar">
        <div class="co-decision-bar__empty">Waiting for next decision...</div>
      </div>
    }
  `,
})
export class CoDecisionBarComponent {
  readonly decision = input<ActiveDecision | null>(null);
  readonly advisorRoles = input<RoleDef[]>([]);
  readonly systems = input<SystemSnapshot[]>([]);
  readonly coIntel = input<string | null>(null);

  readonly confirmed = output<CoDecisionConfirmation>();

  readonly selectedOptionIds = signal<string[]>([]);
  readonly targetSystemSelections = signal<Record<string, string>>({});

  private readonly resetOnDecisionChange = effect(() => {
    this.decision();
    untracked(() => {
      this.selectedOptionIds.set([]);
      this.targetSystemSelections.set({});
    });
  });

  readonly canConfirm = computed(() => this.selectedOptionIds().length > 0);

  protected isSelected(optionId: string): boolean {
    return this.selectedOptionIds().includes(optionId);
  }

  protected getRecommenders(optionId: string): string[] {
    const d = this.decision();
    if (!d) return [];
    const roles = this.advisorRoles();
    const result: string[] = [];
    for (const [key, recOptionId] of Object.entries(d.recommendations)) {
      if (recOptionId === optionId) {
        const roleId = extractRecRoleId(key);
        const role = roles.find((r) => r.id === roleId);
        result.push(role?.label ?? roleId.toUpperCase());
      }
    }
    return result;
  }

  protected toggleOption(optionId: string): void {
    const d = this.decision();
    if (!d) return;
    if (d.question_type === "single_choice") {
      this.selectedOptionIds.set([optionId]);
    } else {
      const current = this.selectedOptionIds();
      if (current.includes(optionId)) {
        this.selectedOptionIds.set(current.filter((id) => id !== optionId));
      } else {
        this.selectedOptionIds.set([...current, optionId]);
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

  protected onConfirm(): void {
    this.confirmed.emit({
      selectedOptionIds: this.selectedOptionIds(),
      targetSystemSelections: this.targetSystemSelections(),
    });
  }
}
