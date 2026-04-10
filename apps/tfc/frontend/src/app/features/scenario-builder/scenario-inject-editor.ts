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
      @for (injectDef of store.content().injects; track injectDef.id) {
        <div class="flex flex-col gap-xs p-sm border-b">
          @if (editingId() === injectDef.id) {
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
                <div class="flex flex-col gap-xs" style="flex:1">
                  <label class="text-xs">Execution Mode</label>
                  <select class="input-base" [value]="editExecMode()"
                    (change)="editExecMode.set(sel($event))">
                    <option value="automatic">Automatic</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
              </div>
              <div class="flex gap-sm">
                <ui-input id="edit-inj-pt" label="PT (ms)"
                  [value]="'' + editPt()" (valueChange)="editPt.set(+$event)" />
                <ui-input id="edit-inj-dur" label="Duration (ms)"
                  [value]="'' + (editDur() ?? '')"
                  (valueChange)="editDur.set($event ? +$event : null)" />
              </div>
              <ui-input id="edit-inj-deps" label="Dependencies (comma-sep inject IDs)"
                [value]="editDeps()" (valueChange)="editDeps.set($event)" />
              <ui-input id="edit-inj-roles" label="Target Roles (comma-sep)"
                [value]="editRoles()" (valueChange)="editRoles.set($event)" />
              <div class="flex gap-sm">
                <button uiButton variant="default" size="sm" (click)="save(injectDef.id)">Save</button>
                <button uiButton variant="outline" size="sm"
                  (click)="editingId.set(null)">Cancel</button>
              </div>
            </div>
          } @else {
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-medium">{{ injectDef.title }}</span>
                <ui-badge variant="secondary">{{ injectDef.inject_type }}</ui-badge>
                @if (injectDef.execution_mode === 'manual') {
                  <ui-badge variant="outline">manual</ui-badge>
                }
                <span class="text-xs text-muted-foreground ml-sm">
                  @ {{ injectDef.scheduled_pt_ms / 1000 }}s
                </span>
              </div>
              <div class="flex gap-xs">
                <button uiButton variant="outline" size="sm"
                  (click)="edit(injectDef)">Edit</button>
                <button uiButton variant="destructive" size="sm"
                  (click)="store.removeInject(injectDef.id)">Remove</button>
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
  protected readonly editExecMode = signal('automatic');
  protected readonly editPt = signal(0);
  protected readonly editDur = signal<number | null>(null);
  protected readonly editDeps = signal('');
  protected readonly editRoles = signal('');

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
      execution_mode: 'automatic',
    });
    this.newTitle.set('');
    this.newTime.set('');
  }

  protected edit(injectDef: ScenarioInjectDef): void {
    this.editingId.set(injectDef.id);
    this.editTitle.set(injectDef.title);
    this.editDesc.set(injectDef.description);
    this.editType.set(injectDef.inject_type);
    this.editExecMode.set(injectDef.execution_mode ?? 'automatic');
    this.editPt.set(injectDef.scheduled_pt_ms);
    this.editDur.set(injectDef.duration_ms);
    this.editDeps.set((injectDef.dependencies ?? []).join(', '));
    this.editRoles.set((injectDef.target_roles ?? []).join(', '));
  }

  protected save(injectId: string): void {
    const deps = this.editDeps().split(',').map((s) => s.trim()).filter(Boolean);
    const roles = this.editRoles().split(',').map((s) => s.trim()).filter(Boolean);
    this.store.updateInject(injectId, {
      title: this.editTitle(),
      description: this.editDesc(),
      inject_type: this.editType(),
      execution_mode: this.editExecMode(),
      scheduled_pt_ms: this.editPt(),
      duration_ms: this.editDur(),
      dependencies: deps,
      target_roles: roles.length ? roles : undefined,
    });
    this.editingId.set(null);
  }
}
