import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardComponent, ButtonDirective, InputComponent, BadgeComponent } from '@aspect/ui';
import type { ScenarioInjectDef } from '../../core/scenario-api.service';
import { ScenarioBuilderStore } from './scenario-builder.store';

@Component({
  selector: 'tfc-scenario-inject-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CardComponent, ButtonDirective, InputComponent, BadgeComponent],
  template: `
    <ui-card title="Injects">
      @for (inject of store.content().injects; track inject.id) {
        <div class="flex flex-col gap-xs p-sm border-b">
          @if (editingId() === inject.id) {
            <div class="flex flex-col gap-xs">
              <ui-input id="edit-inj-title" label="Title"
                [value]="editTitle()" (valueChange)="editTitle.set($event)" />
              <ui-input id="edit-inj-desc" label="Description"
                [value]="editDesc()" (valueChange)="editDesc.set($event)" />
              <div class="flex gap-sm">
                <div class="flex flex-col gap-xs" style="flex:1">
                  <label class="text-xs">Type</label>
                  <select class="input-base" [value]="editType()"
                    (change)="editType.set(sel($event))">
                    <option value="informational">Informational</option>
                    <option value="operational">Operational</option>
                    <option value="decision">Decision</option>
                  </select>
                </div>
                <ui-input id="edit-inj-pt" label="PT (ms)"
                  [value]="'' + editPt()" (valueChange)="editPt.set(+$event)" />
                <ui-input id="edit-inj-dur" label="Duration (ms)"
                  [value]="'' + (editDur() ?? '')" (valueChange)="editDur.set($event ? +$event : null)" />
              </div>
              <div class="flex gap-sm">
                <button uiButton variant="default" size="sm" (click)="save(inject.id)">Save</button>
                <button uiButton variant="outline" size="sm" (click)="editingId.set(null)">Cancel</button>
              </div>
            </div>
          } @else {
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-medium">{{ inject.title }}</span>
                <ui-badge variant="secondary">{{ inject.inject_type }}</ui-badge>
                <span class="text-xs text-muted-foreground ml-sm">
                  @ {{ inject.scheduled_pt_ms / 1000 }}s
                </span>
              </div>
              <div class="flex gap-xs">
                <button uiButton variant="outline" size="sm" (click)="edit(inject)">Edit</button>
                <button uiButton variant="destructive" size="sm"
                  (click)="store.removeInject(inject.id)">Remove</button>
              </div>
            </div>
          }
        </div>
      } @empty {
        <p class="text-muted-foreground text-sm p-sm">No injects yet.</p>
      }
      <div class="flex gap-sm p-sm border-t">
        <ui-input id="inject-title" label="" placeholder="Inject title"
          [(value)]="newTitle" />
        <ui-input id="inject-time" label="" placeholder="PT (ms)"
          [(value)]="newTime" />
        <select class="input-base" [value]="newType()"
          (change)="newType.set(sel($event))">
          <option value="operational">Operational</option>
          <option value="informational">Informational</option>
          <option value="decision">Decision</option>
        </select>
        <button uiButton variant="outline" size="sm" (click)="add()">Add</button>
      </div>
    </ui-card>
  `,
})
export class ScenarioInjectEditorComponent {
  protected readonly store = inject(ScenarioBuilderStore);
  private counter = 0;

  protected readonly newTitle = signal('');
  protected readonly newTime = signal('');
  protected readonly newType = signal('operational');

  protected readonly editingId = signal<string | null>(null);
  protected readonly editTitle = signal('');
  protected readonly editDesc = signal('');
  protected readonly editType = signal('operational');
  protected readonly editPt = signal(0);
  protected readonly editDur = signal<number | null>(null);

  protected sel(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected add(): void {
    const title = this.newTitle().trim();
    const time = parseFloat(this.newTime()) || 0;
    if (!title) return;
    this.store.addInject({
      id: `inj-${++this.counter}`,
      title,
      description: '',
      inject_type: this.newType(),
      scheduled_pt_ms: time,
      duration_ms: null,
      dependencies: [],
      triggered_defects: [],
    });
    this.newTitle.set('');
    this.newTime.set('');
  }

  protected edit(injectDef: ScenarioInjectDef): void {
    this.editingId.set(injectDef.id);
    this.editTitle.set(injectDef.title);
    this.editDesc.set(injectDef.description);
    this.editType.set(injectDef.inject_type);
    this.editPt.set(injectDef.scheduled_pt_ms);
    this.editDur.set(injectDef.duration_ms);
  }

  protected save(injectId: string): void {
    this.store.updateInject(injectId, {
      title: this.editTitle(),
      description: this.editDesc(),
      inject_type: this.editType(),
      scheduled_pt_ms: this.editPt(),
      duration_ms: this.editDur(),
    });
    this.editingId.set(null);
  }
}
