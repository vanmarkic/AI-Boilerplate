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
import type { RoleDef } from "../../core/scenario-api.service";
import { ScenarioBuilderStore } from "./scenario-builder.store";

@Component({
  selector: "tfc-scenario-roles-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, ButtonDirective, InputComponent, BadgeComponent],
  template: `
    <ui-card title="Roles">
      @for (role of store.content().roles ?? []; track role.id) {
        <div
          class="flex flex-col gap-xs p-sm border-b"
          [id]="'role-' + role.id"
        >
          @if (editingId() === role.id) {
            <div class="flex flex-col gap-xs">
              <ui-input
                id="edit-role-id"
                label="ID"
                [value]="editId()"
                (valueChange)="editId.set($event)"
              />
              <ui-input
                id="edit-role-label"
                label="Label"
                [value]="editLabel()"
                (valueChange)="editLabel.set($event)"
              />
              <div class="flex flex-col gap-xs" style="flex:1">
                <label class="text-xs">Player Type</label>
                <select
                  class="input-base"
                  [value]="editPlayerType()"
                  (change)="editPlayerType.set(sel($event))"
                >
                  <option value="decision_maker">Decision Maker</option>
                  <option value="advisor">Advisor</option>
                </select>
              </div>
              <div class="flex gap-sm">
                <button
                  uiButton
                  variant="default"
                  size="sm"
                  (click)="save(role.id)"
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
                <span class="text-sm font-medium">{{ role.label }}</span>
                <ui-badge variant="secondary">{{ role.player_type }}</ui-badge>
                <span class="text-xs text-muted-foreground ml-sm">{{
                  role.id
                }}</span>
              </div>
              <div class="flex gap-xs">
                <button
                  uiButton
                  variant="outline"
                  size="sm"
                  (click)="edit(role)"
                >
                  Edit
                </button>
                <button
                  uiButton
                  variant="destructive"
                  size="sm"
                  (click)="store.removeRole(role.id)"
                >
                  Remove
                </button>
              </div>
            </div>
          }
        </div>
      } @empty {
        <p class="text-muted-foreground text-sm p-sm">No roles yet.</p>
      }
      <div class="flex gap-sm p-sm border-t">
        <ui-input
          id="role-id"
          label=""
          placeholder="Role ID"
          [(value)]="newId"
        />
        <ui-input
          id="role-label"
          label=""
          placeholder="Label"
          [(value)]="newLabel"
        />
        <button uiButton variant="outline" size="sm" (click)="add()">
          Add
        </button>
      </div>
    </ui-card>
  `,
})
export class ScenarioRolesEditorComponent {
  protected readonly store = inject(ScenarioBuilderStore);

  protected readonly newId = signal("");
  protected readonly newLabel = signal("");
  protected readonly editingId = signal<string | null>(null);
  protected readonly editId = signal("");
  protected readonly editLabel = signal("");
  protected readonly editPlayerType = signal("advisor");

  protected sel(event: Event): string {
    const target = event.target;
    if (target instanceof HTMLSelectElement) return target.value;
    return "";
  }

  protected add(): void {
    const id = this.newId().trim();
    const label = this.newLabel().trim();
    if (!id || !label) return;
    this.store.addRole({ id, label, player_type: "advisor" });
    this.newId.set("");
    this.newLabel.set("");
  }

  protected edit(role: RoleDef): void {
    this.editingId.set(role.id);
    this.editId.set(role.id);
    this.editLabel.set(role.label);
    this.editPlayerType.set(role.player_type);
  }

  protected save(roleId: string): void {
    this.store.updateRole(roleId, {
      id: this.editId(),
      label: this.editLabel(),
      player_type: this.editPlayerType(),
    });
    this.editingId.set(null);
  }
}
