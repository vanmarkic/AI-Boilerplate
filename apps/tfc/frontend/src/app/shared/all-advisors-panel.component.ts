import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
  effect,
} from "@angular/core";
import { BadgeComponent, ButtonDirective } from "@aspect/ui";
import { DecisionPanelComponent } from "./decision-panel.component";
import type { DecisionOption } from "./decision-panel.component";

export interface AdvisorRoleTab {
  id: string;
  label: string;
}

export interface RoleRecommendation {
  roleId: string;
  selectedOptions: string[];
  freeText: string;
}

@Component({
  selector: "tfc-all-advisors-panel",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ButtonDirective, DecisionPanelComponent],
  template: `
    <div class="flex flex-col gap-md">
      <div class="flex gap-sm flex-wrap">
        @for (role of roles(); track role.id) {
          <button
            uiButton
            [variant]="activeTab() === role.id ? 'default' : 'outline'"
            (click)="activeTab.set(role.id)"
          >
            {{ role.label }}
            @if (isSubmitted(role.id)) {
              <ui-badge
                variant="secondary"
                style="margin-left: var(--spacing-xs)"
                >Done</ui-badge
              >
            }
          </button>
        }
      </div>

      @for (role of roles(); track role.id) {
        @if (activeTab() === role.id && !isSubmitted(role.id)) {
          <tfc-decision-panel
            [title]="'[' + role.label + '] ' + decisionTitle()"
            [description]="decisionDescription()"
            [questionType]="questionType()"
            [options]="options()"
            (submitted)="onRoleSubmit(role.id, $event)"
            (closed)="closed.emit()"
          />
        }
        @if (activeTab() === role.id && isSubmitted(role.id)) {
          <p class="text-sm text-muted-foreground p-md">
            Recommendation submitted as {{ role.label }}.
          </p>
        }
      }
    </div>
  `,
})
export class AllAdvisorsPanelComponent {
  readonly roles = input.required<AdvisorRoleTab[]>();
  readonly decisionTitle = input.required<string>();
  readonly decisionDescription = input<string>("");
  readonly questionType = input.required<string>();
  readonly options = input<DecisionOption[]>([]);
  readonly submitted = output<RoleRecommendation>();
  readonly closed = output();

  protected readonly activeTab = signal("");
  private readonly submittedRoles = signal<Set<string>>(new Set());

  constructor() {
    effect(() => {
      const roles = this.roles();
      if (roles.length > 0 && !this.activeTab()) {
        this.activeTab.set(roles[0].id);
      }
    });
  }

  protected isSubmitted(roleId: string): boolean {
    return this.submittedRoles().has(roleId);
  }

  protected onRoleSubmit(
    roleId: string,
    event: { selectedOptions: string[]; freeText: string },
  ): void {
    const updated = new Set(this.submittedRoles());
    updated.add(roleId);
    this.submittedRoles.set(updated);
    this.submitted.emit({
      roleId,
      selectedOptions: event.selectedOptions,
      freeText: event.freeText,
    });
    // Auto-advance to next unsubmitted role
    const next = this.roles().find((r) => !updated.has(r.id));
    if (next) {
      this.activeTab.set(next.id);
    }
  }
}
