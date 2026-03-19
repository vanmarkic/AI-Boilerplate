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
import { extractRecRoleId, type RoleCard } from "./role-card.types";

export interface RoleCardSubmission {
  roleId: string;
  selectedOptions: string[];
  freeText: string;
}

@Component({
  selector: "tfc-role-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UpperCasePipe, BadgeComponent, ButtonDirective],
  template: `
    <div class="role-card"
      [class.role-card--intel]="card().status === 'intel'"
      [class.role-card--active]="card().status === 'active'"
      [class.role-card--done]="card().status === 'done'">

      <!-- Header -->
      <div class="role-card__header">
        <span class="role-card__role-id">{{ card().roleId | uppercase }}</span>
        <ui-badge [variant]="card().status === 'active' ? 'default' : 'secondary'">
          {{ badgeLabel() }}
        </ui-badge>
      </div>
      <div class="role-card__role-label">{{ card().roleLabel }}</div>

      <!-- Intel -->
      @if (card().intel) {
        <div class="role-card__intel">{{ card().intel }}</div>
      } @else if (card().decision) {
        <div class="role-card__intel role-card__intel--empty">No role-specific intel this turn</div>
      }

      <!-- Advisor Recs (CO card only) -->
      @if (card().advisorRecs.length > 0) {
        <div class="role-card__recs">
          <div class="role-card__recs-title">Advisor Recommendations</div>
          @for (rec of card().advisorRecs; track rec.roleId) {
            <div class="role-card__rec" [class.role-card__rec--pending]="!rec.selection">
              <span class="role-card__rec-role">{{ rec.roleLabel }}:</span>
              @if (rec.selection) {
                <span class="role-card__rec-selection">{{ rec.selection }}</span>
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
          <div class="role-card__decision-question">{{ card().decision!.description }}</div>
          @if (questionType() === 'single_choice' || questionType() === 'multi_choice') {
            @for (option of filteredOptions(); track option.id) {
              <label class="role-card__option" [class.role-card__option--selected]="isSelected(option.id)">
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
            <textarea class="role-card__textarea"
              [value]="freeText()"
              (input)="onTextInput($event)"
              placeholder="Enter your response..."></textarea>
          }
          <div class="role-card__actions">
            <button uiButton variant="default" size="sm" (click)="onSubmit()" [disabled]="!canSubmit()">
              Submit
            </button>
          </div>
        </div>
      }

      <!-- Done State -->
      @if (card().status === 'done') {
        <div class="role-card__done">Selected: {{ doneLabel() }}</div>
      }
    </div>
  `,
})
export class RoleCardComponent {
  readonly card = input.required<RoleCard>();
  readonly submitted = output<RoleCardSubmission>();

  readonly selectedOptions = signal<string[]>([]);
  readonly freeText = signal("");

  private readonly resetOnCardChange = effect(() => {
    this.card();
    untracked(() => {
      this.selectedOptions.set([]);
      this.freeText.set("");
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
    return decision.options.filter(
      (o) => !o.role || o.role === roleId,
    );
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

  protected isSelected(optionId: string): boolean {
    return this.selectedOptions().includes(optionId);
  }

  protected canSubmit(): boolean {
    if (this.questionType() === "free_text") {
      return this.freeText().trim().length > 0;
    }
    return this.selectedOptions().length > 0;
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

  protected onTextInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.freeText.set(textarea.value);
  }

  protected onSubmit(): void {
    this.submitted.emit({
      roleId: this.card().roleId,
      selectedOptions: this.selectedOptions(),
      freeText: this.freeText(),
    });
  }
}
