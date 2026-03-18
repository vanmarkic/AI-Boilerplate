import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  PageHeaderComponent, CardComponent, ButtonDirective, InputComponent,
  BadgeComponent, CollapsiblePanelComponent,
} from '@aspect/ui';
import { DomainService } from '../../core/domain.service';
import { ScenarioApiService } from '../../core/scenario-api.service';
import type { DecisionTemplateDef } from '../../core/scenario-api.service';
import { ScenarioBuilderStore } from './scenario-builder.store';
import { ScenarioEventEditorComponent } from './scenario-event-editor';
import { ScenarioIssueEditorComponent } from './scenario-issue-editor';
import { validateScenarioContent } from './validate-scenario-content';

@Component({
  selector: 'tfc-scenario-builder-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ScenarioBuilderStore],
  imports: [
    FormsModule, PageHeaderComponent, CardComponent, ButtonDirective,
    InputComponent, BadgeComponent, CollapsiblePanelComponent,
    ScenarioEventEditorComponent, ScenarioIssueEditorComponent,
  ],
  template: `
    <div class="flex flex-col gap-md p-lg">
      <ui-page-header title="Scenario Builder" />

      <div class="flex gap-md">
        <ui-input id="scenario-title" label="Title" placeholder="Scenario title"
          [value]="store.title()" (valueChange)="store.setTitle($event)" />
        <ui-input id="scenario-desc" label="Description" placeholder="Description"
          [value]="store.description()" (valueChange)="store.setDescription($event)" />
        <button uiButton variant="default" (click)="save()">
          {{ store.scenarioId() ? 'Update' : 'Create' }}
        </button>
        @if (store.scenarioId()) {
          <button uiButton variant="outline" (click)="store.reset()">New</button>
        }
      </div>

      @if (store.error()) {
        <div class="p-sm border border-destructive bg-destructive/10 text-destructive text-sm rounded"
          role="alert">
          <strong>Validation errors:</strong>
          <ul class="mt-xs ml-md list-disc">
            @for (err of store.error()!.split('\\n'); track err) {
              <li>{{ err }}</li>
            }
          </ul>
        </div>
      }

      <div class="grid grid-cols-2 gap-md">
        <tfc-scenario-event-editor />
        <tfc-scenario-issue-editor />

        <ui-card [title]="domain.term('decision') + ' Templates'">
          @for (dt of store.content().decision_templates; track dt.id) {
            <div class="flex flex-col gap-xs p-sm border-b">
              @if (editingDtId() === dt.id) {
                <div class="flex flex-col gap-xs">
                  <ui-input id="edit-dt-title" label="Title"
                    [value]="editDtTitle()" (valueChange)="editDtTitle.set($event)" />
                  <ui-input id="edit-dt-desc" label="Description"
                    [value]="editDtDesc()" (valueChange)="editDtDesc.set($event)" />
                  <div class="flex gap-sm">
                    <ui-input id="edit-dt-issue" label="Issue ID"
                      [value]="editDtIssueId()" (valueChange)="editDtIssueId.set($event)" />
                    <div class="flex flex-col gap-xs" style="flex:1">
                      <label class="text-xs">Question Type</label>
                      <select class="input-base" [value]="editDtQType()"
                        (change)="editDtQType.set(sel($event))">
                        <option value="single_choice">Single Choice</option>
                        <option value="multi_choice">Multi Choice</option>
                        <option value="free_text">Free Text</option>
                      </select>
                    </div>
                  </div>
                  <div class="flex gap-sm">
                    <button uiButton variant="default" size="sm" (click)="saveDt(dt.id)">Save</button>
                    <button uiButton variant="outline" size="sm" (click)="editingDtId.set(null)">Cancel</button>
                  </div>
                </div>
              } @else {
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-sm font-medium">{{ dt.title }}</span>
                    <ui-badge variant="secondary">{{ dt.question_type }}</ui-badge>
                    <span class="text-xs text-muted-foreground ml-sm">issue: {{ dt.issue_id }}</span>
                  </div>
                  <div class="flex gap-xs">
                    <button uiButton variant="outline" size="sm" (click)="editDt(dt)">Edit</button>
                    <button uiButton variant="destructive" size="sm"
                      (click)="store.removeDecisionTemplate(dt.id)">Remove</button>
                  </div>
                </div>
              }
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">No decision templates yet.</p>
          }
          <div class="flex gap-sm p-sm border-t">
            <ui-input id="dt-title" label="" placeholder="Decision title"
              [(value)]="newDtTitle" />
            <ui-input id="dt-issue" label="" placeholder="Issue ID"
              [(value)]="newDtIssueId" />
            <button uiButton variant="outline" size="sm" (click)="addDt()">Add</button>
          </div>
        </ui-card>

        <ui-card title="Settings">
          <div class="flex flex-col gap-sm p-sm">
            <div class="flex items-center gap-sm">
              <span class="text-sm">Default Time Factor:</span>
              <input type="number" class="input-base" style="width: 80px"
                [value]="store.content().default_time_factor"
                (change)="onTimeFactorChange($event)" />
            </div>
            <div class="flex flex-col gap-xs">
              <span class="text-sm">Briefing:</span>
              <textarea class="input-base" rows="3"
                [value]="store.content().briefing ?? ''"
                (input)="onBriefingChange($event)"></textarea>
            </div>
          </div>
        </ui-card>
      </div>

      <ui-collapsible-panel>
        <span panelTitle>Existing Scenarios</span>
        @for (s of scenarios(); track s.id) {
          <div class="flex items-center justify-between p-sm border-b">
            <span class="text-sm font-medium cursor-pointer" (click)="loadScenario(s.id)">
              {{ s.title }}
            </span>
            <button uiButton variant="destructive" size="sm"
              (click)="deleteScenario(s.id)">Delete</button>
          </div>
        } @empty {
          <p class="text-muted-foreground text-sm p-sm">No scenarios found.</p>
        }
      </ui-collapsible-panel>
    </div>
  `,
})
export class ScenarioBuilderView implements OnInit {
  protected readonly store = inject(ScenarioBuilderStore);
  protected readonly domain = inject(DomainService);
  private readonly api = inject(ScenarioApiService);
  protected readonly scenarios = signal<{ id: number; title: string }[]>([]);
  private counter = 0;

  protected readonly newDtTitle = signal('');
  protected readonly newDtIssueId = signal('');
  protected readonly editingDtId = signal<string | null>(null);
  protected readonly editDtTitle = signal('');
  protected readonly editDtDesc = signal('');
  protected readonly editDtIssueId = signal('');
  protected readonly editDtQType = signal('single_choice');

  ngOnInit(): void { this.loadList(); }

  protected sel(event: Event): string {
    return (event.target as HTMLSelectElement).value;
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
    if (!this.store.title().trim()) {
      errors.unshift('Title is required.');
    }
    if (errors.length > 0) {
      this.store.setError(errors.join('\n'));
      return;
    }
    this.store.setSaving(true);
    const payload = {
      title: this.store.title(),
      description: this.store.description(),
      content,
    };
    const id = this.store.scenarioId();
    const req = id ? this.api.update(id, payload) : this.api.create(payload);
    req.subscribe({
      next: (s) => {
        this.store.loadScenario(s.id, s.title, s.description, s.content);
        this.store.setSaving(false);
        this.loadList();
      },
      error: () => this.store.setError('Save failed — server rejected the scenario.'),
    });
  }

  protected deleteScenario(id: number): void {
    this.api.delete(id).subscribe({ next: () => this.loadList() });
  }

  protected addDt(): void {
    const title = this.newDtTitle().trim();
    const issueId = this.newDtIssueId().trim();
    if (!title || !issueId) return;
    this.store.addDecisionTemplate({
      id: `dt-${++this.counter}`, title, description: '',
      issue_id: issueId, question_type: 'single_choice',
      options: [], completion_mode: 'first_response',
    });
    this.newDtTitle.set('');
    this.newDtIssueId.set('');
  }

  protected editDt(dt: DecisionTemplateDef): void {
    this.editingDtId.set(dt.id);
    this.editDtTitle.set(dt.title);
    this.editDtDesc.set(dt.description);
    this.editDtIssueId.set(dt.issue_id);
    this.editDtQType.set(dt.question_type);
  }

  protected saveDt(dtId: string): void {
    this.store.updateDecisionTemplate(dtId, {
      title: this.editDtTitle(), description: this.editDtDesc(),
      issue_id: this.editDtIssueId(), question_type: this.editDtQType(),
    });
    this.editingDtId.set(null);
  }

  protected onTimeFactorChange(event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    if (val > 0) this.store.setTimeFactor(val);
  }

  protected onBriefingChange(event: Event): void {
    this.store.setBriefing((event.target as HTMLTextAreaElement).value);
  }
}
