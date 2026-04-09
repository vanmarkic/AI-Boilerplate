import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardComponent, ButtonDirective, InputComponent, BadgeComponent } from '@aspect/ui';
import type { ScenarioIssueDef } from '../../core/scenario-api.service';
import { ScenarioBuilderStore } from './scenario-builder.store';

@Component({
  selector: 'tfc-scenario-issue-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CardComponent, ButtonDirective, InputComponent, BadgeComponent],
  template: `
    <ui-card title="Issues">
      @for (issue of store.content().issues; track issue.id) {
        <div class="flex flex-col gap-xs p-sm border-b">
          @if (editingId() === issue.id) {
            <div class="flex flex-col gap-xs">
              <ui-input id="edit-iss-title" label="Title"
                [value]="editTitle()" (valueChange)="editTitle.set($event)" />
              <ui-input id="edit-iss-desc" label="Description"
                [value]="editDesc()" (valueChange)="editDesc.set($event)" />
              <div class="flex gap-sm">
                <div class="flex flex-col gap-xs" style="flex:1">
                  <label class="text-xs">Trigger</label>
                  <select class="input-base" [value]="editTrigger()"
                    (change)="editTrigger.set(sel($event))">
                    <option value="manual">Manual</option>
                    <option value="time-based">Time-based</option>
                    <option value="event-based">Event-based</option>
                  </select>
                </div>
                <ui-input id="edit-iss-ar" label="Auto-resolve (ms)"
                  [value]="'' + editAutoResolve()" (valueChange)="editAutoResolve.set(+$event)" />
              </div>
              <div class="flex gap-sm">
                <button uiButton variant="default" size="sm" (click)="save(issue.id)">Save</button>
                <button uiButton variant="outline" size="sm" (click)="editingId.set(null)">Cancel</button>
              </div>
            </div>
          } @else {
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-medium">{{ issue.title }}</span>
                <ui-badge variant="secondary">{{ issue.trigger_mode }}</ui-badge>
                @if (issue.auto_resolve_ms > 0) {
                  <span class="text-xs text-muted-foreground ml-sm">
                    auto-resolve: {{ issue.auto_resolve_ms / 1000 }}s
                  </span>
                }
              </div>
              <div class="flex gap-xs">
                <button uiButton variant="outline" size="sm" (click)="edit(issue)">Edit</button>
                <button uiButton variant="destructive" size="sm"
                  (click)="store.removeIssue(issue.id)">Remove</button>
              </div>
            </div>
          }
        </div>
      } @empty {
        <p class="text-muted-foreground text-sm p-sm">No issues yet.</p>
      }
      <div class="flex gap-sm p-sm border-t">
        <ui-input id="issue-title" label="" placeholder="Issue title"
          [(value)]="newTitle" />
        <select class="input-base" [value]="newTrigger()"
          (change)="newTrigger.set(sel($event))">
          <option value="manual">Manual</option>
          <option value="time-based">Time-based</option>
          <option value="event-based">Event-based</option>
        </select>
        <button uiButton variant="outline" size="sm" (click)="add()">Add</button>
      </div>
    </ui-card>
  `,
})
export class ScenarioIssueEditorComponent {
  protected readonly store = inject(ScenarioBuilderStore);
  private counter = 0;

  protected readonly newTitle = signal('');
  protected readonly newTrigger = signal('manual');

  protected readonly editingId = signal<string | null>(null);
  protected readonly editTitle = signal('');
  protected readonly editDesc = signal('');
  protected readonly editTrigger = signal('manual');
  protected readonly editAutoResolve = signal(0);

  protected sel(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected add(): void {
    const title = this.newTitle().trim();
    if (!title) return;
    this.store.addIssue({
      id: `iss-${++this.counter}`,
      title,
      description: '',
      trigger_mode: this.newTrigger(),
      trigger_time_pt_ms: null,
      trigger_event_id: null,
      auto_resolve_ms: 0,
    });
    this.newTitle.set('');
  }

  protected edit(issue: ScenarioIssueDef): void {
    this.editingId.set(issue.id);
    this.editTitle.set(issue.title);
    this.editDesc.set(issue.description);
    this.editTrigger.set(issue.trigger_mode);
    this.editAutoResolve.set(issue.auto_resolve_ms);
  }

  protected save(issueId: string): void {
    this.store.updateIssue(issueId, {
      title: this.editTitle(),
      description: this.editDesc(),
      trigger_mode: this.editTrigger(),
      auto_resolve_ms: this.editAutoResolve(),
    });
    this.editingId.set(null);
  }
}
