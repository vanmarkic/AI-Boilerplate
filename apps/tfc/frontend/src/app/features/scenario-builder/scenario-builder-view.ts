import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  PageHeaderComponent, CardComponent, ButtonDirective, InputComponent,
  BadgeComponent, CollapsiblePanelComponent,
} from '@aspect/ui';
import { DomainService } from '../../core/domain.service';
import { ScenarioApiService } from '../../core/scenario-api.service';
import { ScenarioBuilderStore } from './scenario-builder.store';

@Component({
  selector: 'tfc-scenario-builder-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ScenarioBuilderStore],
  imports: [
    FormsModule, PageHeaderComponent, CardComponent, ButtonDirective,
    InputComponent, BadgeComponent, CollapsiblePanelComponent,
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
      </div>

      <div class="grid grid-cols-2 gap-md">
        <ui-card [title]="domain.term('event') + 's'">
          @for (event of store.content().events; track event.id) {
            <div class="flex items-center justify-between p-sm border-b">
              <div>
                <span class="text-sm font-medium">{{ event.title }}</span>
                <span class="text-xs text-muted-foreground ml-sm">
                  @ {{ event.scheduled_pt_ms / 1000 }}s
                </span>
              </div>
              <button uiButton variant="destructive" size="sm"
                (click)="store.removeEvent(event.id)">Remove</button>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">No events yet.</p>
          }
          <div class="flex gap-sm p-sm border-t">
            <ui-input id="event-title" label="" placeholder="Event title"
              [(value)]="newEventTitle" />
            <ui-input id="event-time" label="" placeholder="PT (ms)"
              [(value)]="newEventTime" />
            <button uiButton variant="outline" size="sm" (click)="addEvent()">Add</button>
          </div>
        </ui-card>

        <ui-card [title]="domain.term('issue') + 's'">
          @for (issue of store.content().issues; track issue.id) {
            <div class="flex items-center justify-between p-sm border-b">
              <div>
                <span class="text-sm font-medium">{{ issue.title }}</span>
                <ui-badge variant="secondary">{{ issue.trigger_mode }}</ui-badge>
              </div>
              <button uiButton variant="destructive" size="sm"
                (click)="store.removeIssue(issue.id)">Remove</button>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">No issues yet.</p>
          }
          <div class="flex gap-sm p-sm border-t">
            <ui-input id="issue-title" label="" placeholder="Issue title"
              [(value)]="newIssueTitle" />
            <button uiButton variant="outline" size="sm" (click)="addIssue()">Add</button>
          </div>
        </ui-card>

        <ui-card [title]="domain.term('decision') + ' Templates'">
          @for (dt of store.content().decision_templates; track dt.id) {
            <div class="flex items-center justify-between p-sm border-b">
              <span class="text-sm font-medium">{{ dt.title }}</span>
              <button uiButton variant="destructive" size="sm"
                (click)="store.removeDecisionTemplate(dt.id)">Remove</button>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">No decision templates yet.</p>
          }
        </ui-card>

        <ui-card title="Settings">
          <div class="flex flex-col gap-sm p-sm">
            <div class="flex items-center gap-sm">
              <span class="text-sm">Default Time Factor:</span>
              <input type="number" class="input-base" style="width: 80px"
                [value]="store.content().default_time_factor"
                (change)="onTimeFactorChange($event)" />
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
  protected readonly newEventTitle = signal('');
  protected readonly newEventTime = signal('');
  protected readonly newIssueTitle = signal('');
  private counter = 0;

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
    this.store.setSaving(true);
    const payload = {
      title: this.store.title(),
      description: this.store.description(),
      content: this.store.content(),
    };
    const id = this.store.scenarioId();
    const req = id ? this.api.update(id, payload) : this.api.create(payload);
    req.subscribe({
      next: (s) => {
        this.store.loadScenario(s.id, s.title, s.description, s.content);
        this.store.setSaving(false);
        this.loadList();
      },
      error: () => this.store.setError('Save failed'),
    });
  }

  protected deleteScenario(id: number): void {
    this.api.delete(id).subscribe({ next: () => this.loadList() });
  }

  protected addEvent(): void {
    const title = this.newEventTitle().trim();
    const time = parseFloat(this.newEventTime()) || 0;
    if (!title) return;
    this.store.addEvent({
      id: `evt-${++this.counter}`,
      title,
      description: '',
      event_type: 'operational',
      scheduled_pt_ms: time,
      duration_ms: null,
      dependencies: [],
      triggered_issues: [],
    });
    this.newEventTitle.set('');
    this.newEventTime.set('');
  }

  protected addIssue(): void {
    const title = this.newIssueTitle().trim();
    if (!title) return;
    this.store.addIssue({
      id: `iss-${++this.counter}`,
      title,
      description: '',
      trigger_mode: 'manual',
      trigger_time_pt_ms: null,
      trigger_event_id: null,
      auto_resolve_ms: 0,
    });
    this.newIssueTitle.set('');
  }

  protected onTimeFactorChange(event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    if (val > 0) this.store.setTimeFactor(val);
  }
}
