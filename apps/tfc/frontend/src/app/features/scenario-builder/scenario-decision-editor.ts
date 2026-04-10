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
                <div class="flex flex-col gap-xs" style="flex:1">
                  <label class="text-xs">Completion Mode</label>
                  <select
                    class="input-base"
                    [value]="editCompletionMode()"
                    (change)="editCompletionMode.set(sel($event))"
                  >
                    <option value="first_response">First response</option>
                    <option value="all_respond">All respond</option>
                    <option value="gm_closes">GM closes</option>
                    <option value="trainer_validation">Trainer validation</option>
                  </select>
                </div>
              </div>
              @if (editCompletionMode() === 'all_respond') {
                <div class="flex flex-col gap-xs">
                  <span class="text-xs text-muted-foreground"
                    >Target roles:</span
                  >
                  <div class="flex gap-sm flex-wrap">
                    @for (role of store.content().roles ?? []; track role.id) {
                      <label class="flex items-center gap-xs text-sm">
                        <input
                          type="checkbox"
                          [checked]="editTargetRoles().includes(role.id)"
                          (change)="toggleTargetRole(role.id, $event)"
                        />
                        {{ role.label }}
                      </label>
                    }
                  </div>
                </div>
              }
              <div class="flex gap-sm">
                <button
                  uiButton
                  variant="default"
                  size="sm"
                  (click)="save(dt.id)"
                >
                  Save
                </button>
                <button
                  uiButton
                  variant="outline"
                  size="sm"
                  (click)="editingId.set(null)"
                >
                  Cancel
                </button>
              </div>
            </div>
          } @else {
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-medium">{{ dt.title }}</span>
                <ui-badge variant="secondary">{{ dt.question_type }}</ui-badge>
                <ui-badge variant="secondary">{{
                  dt.completion_mode
                }}</ui-badge>
                @if (dt.issue_id) {
                  <span
                    class="text-xs text-muted-foreground ml-sm cursor-pointer"
                    style="text-decoration: underline dotted"
                    (click)="scrollTo('issue-' + dt.issue_id)"
                    >issue: {{ dt.issue_id }}</span
                  >
                }
              </div>
              <div class="flex gap-xs">
                <button uiButton variant="outline" size="sm" (click)="edit(dt)">
                  Edit
                </button>
                <button
                  uiButton
                  variant="destructive"
                  size="sm"
                  (click)="store.removeDecisionTemplate(dt.id)"
                >
                  Remove
                </button>
              </div>
            </div>
          }
        </div>
      } @empty {
        <p class="text-muted-foreground text-sm p-sm">
          No decision templates yet.
        </p>
      }
      <div class="flex gap-sm p-sm border-t">
        <ui-input
          id="dt-title"
          label=""
          placeholder="Decision title"
          [(value)]="newTitle"
        />
        <ui-input
          id="dt-issue"
          label=""
          placeholder="Issue ID"
          [(value)]="newIssueId"
        />
        <button uiButton variant="outline" size="sm" (click)="add()">
          Add
        </button>
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
  protected readonly editCompletionMode = signal("first_response");
  protected readonly editTargetRoles = signal<string[]>([]);

  protected sel(event: Event): string {
    const target = event.target;
    if (target instanceof HTMLSelectElement) return target.value;
    return "";
  }

  protected scrollTo(elementId: string): void {
    document
      .getElementById(elementId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    this.editCompletionMode.set(dt.completion_mode);
    this.editTargetRoles.set(dt.target_roles ?? []);
  }

  protected toggleTargetRole(roleId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const current = this.editTargetRoles();
    const updated = target.checked
      ? [...current, roleId]
      : current.filter((r) => r !== roleId);
    this.editTargetRoles.set(updated);
  }

  protected save(dtId: string): void {
    const completionMode = this.editCompletionMode();
    this.store.updateDecisionTemplate(dtId, {
      title: this.editTitle(),
      description: this.editDesc(),
      issue_id: this.editIssueId(),
      question_type: this.editQType(),
      completion_mode: completionMode,
      target_roles:
        completionMode === "all_respond" ? this.editTargetRoles() : [],
    });
    this.editingId.set(null);
  }
}
