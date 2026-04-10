import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardComponent, ButtonDirective, InputComponent, BadgeComponent } from '@aspect/ui';
import type { ScenarioDefectDef } from '../../core/scenario-api.service';
import { ScenarioBuilderStore } from './scenario-builder.store';

@Component({
  selector: 'tfc-scenario-defect-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CardComponent, ButtonDirective, InputComponent, BadgeComponent],
  template: `
    <ui-card title="Defects">
      @for (defect of store.content().defects; track defect.id) {
        <div class="flex flex-col gap-xs p-sm border-b">
          @if (editingId() === defect.id) {
            <div class="flex flex-col gap-xs">
              <ui-input id="edit-def-title" label="Title"
                [value]="editTitle()" (valueChange)="editTitle.set($event)" />
              <ui-input id="edit-def-desc" label="Description"
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
                <ui-input id="edit-def-trigger-inj" label="Linked Inject ID"
                  [value]="editTriggerInjectId()"
                  (valueChange)="editTriggerInjectId.set($event)" />
              </div>
              <div class="flex gap-sm">
                <ui-input id="edit-def-ar-pt" label="ETBOL (Play Time, ms)"
                  [value]="'' + editAutoResolvePt()"
                  (valueChange)="editAutoResolvePt.set(+$event)" />
                <ui-input id="edit-def-ar-rt" label="ETBOL (Real Time, ms)"
                  [value]="'' + editAutoResolveRt()"
                  (valueChange)="editAutoResolveRt.set(+$event)" />
              </div>
              <div class="flex gap-sm">
                <button uiButton variant="default" size="sm"
                  (click)="save(defect.id)">Save</button>
                <button uiButton variant="outline" size="sm"
                  (click)="editingId.set(null)">Cancel</button>
              </div>
            </div>
          } @else {
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-medium">{{ defect.title }}</span>
                <ui-badge variant="secondary">{{ defect.trigger_mode }}</ui-badge>
                @if (defect.auto_resolve_pt_ms > 0) {
                  <span class="text-xs text-muted-foreground ml-sm">
                    ETBOL PT: {{ defect.auto_resolve_pt_ms / 1000 }}s
                  </span>
                }
                @if ((defect.auto_resolve_rt_ms ?? 0) > 0) {
                  <span class="text-xs text-muted-foreground ml-sm">
                    RT: {{ defect.auto_resolve_rt_ms! / 1000 }}s
                  </span>
                }
              </div>
              <div class="flex gap-xs">
                <button uiButton variant="outline" size="sm"
                  (click)="edit(defect)">Edit</button>
                <button uiButton variant="destructive" size="sm"
                  (click)="store.removeDefect(defect.id)">Remove</button>
              </div>
            </div>
          }
        </div>
      } @empty {
        <p class="text-muted-foreground text-sm p-sm">No defects yet.</p>
      }
      <div class="flex gap-sm p-sm border-t">
        <ui-input id="defect-title" label="" placeholder="Defect title"
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
export class ScenarioDefectEditorComponent {
  protected readonly store = inject(ScenarioBuilderStore);
  private counter = 0;

  protected readonly newTitle = signal('');
  protected readonly newTrigger = signal('manual');

  protected readonly editingId = signal<string | null>(null);
  protected readonly editTitle = signal('');
  protected readonly editDesc = signal('');
  protected readonly editTrigger = signal('manual');
  protected readonly editTriggerInjectId = signal('');
  protected readonly editAutoResolvePt = signal(0);
  protected readonly editAutoResolveRt = signal(0);

  protected sel(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected add(): void {
    const title = this.newTitle().trim();
    if (!title) return;
    this.store.addDefect({
      id: `def-${++this.counter}`,
      title,
      description: '',
      trigger_mode: this.newTrigger(),
      trigger_time_pt_ms: null,
      trigger_inject_id: null,
      auto_resolve_pt_ms: 0,
      auto_resolve_rt_ms: 0,
    });
    this.newTitle.set('');
  }

  protected edit(defect: ScenarioDefectDef): void {
    this.editingId.set(defect.id);
    this.editTitle.set(defect.title);
    this.editDesc.set(defect.description);
    this.editTrigger.set(defect.trigger_mode);
    this.editTriggerInjectId.set(defect.trigger_inject_id ?? '');
    this.editAutoResolvePt.set(defect.auto_resolve_pt_ms);
    this.editAutoResolveRt.set(defect.auto_resolve_rt_ms ?? 0);
  }

  protected save(defectId: string): void {
    const triggerInjectId = this.editTriggerInjectId().trim() || null;
    this.store.updateDefect(defectId, {
      title: this.editTitle(),
      description: this.editDesc(),
      trigger_mode: this.editTrigger(),
      trigger_inject_id: triggerInjectId,
      auto_resolve_pt_ms: this.editAutoResolvePt(),
      auto_resolve_rt_ms: this.editAutoResolveRt(),
    });
    this.editingId.set(null);
  }
}
