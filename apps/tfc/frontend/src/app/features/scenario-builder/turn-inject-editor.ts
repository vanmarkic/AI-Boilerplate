import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from "@angular/core";
import { ButtonDirective, BadgeComponent } from "@aspect/ui";
import type { TurnInjectDef } from "../../core/scenario-api.service";
import { ScenarioBuilderStore } from "./scenario-builder.store";

@Component({
  selector: "tfc-turn-inject-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, BadgeComponent],
  template: `
    @for (inj of injects(); track $index; let i = $index) {
      <div class="flex flex-col gap-xs p-sm border-b">
        <div class="flex items-center gap-xs flex-wrap">
          @if (inj.target_roles.length === 0) {
            <ui-badge variant="secondary">All</ui-badge>
          } @else {
            @for (role of inj.target_roles; track role) {
              <ui-badge variant="secondary">{{ roleLabel(role) }}</ui-badge>
            }
          }
          <button
            uiButton
            variant="destructive"
            size="sm"
            style="margin-left: auto"
            (click)="removeInject(i)"
          >
            Remove
          </button>
        </div>

        <textarea
          class="input-base"
          rows="2"
          placeholder="Inject text..."
          [value]="inj.text"
          (input)="updateText(i, $event)"
        ></textarea>

        <div class="flex flex-col gap-xs">
          <span class="text-xs text-muted-foreground">Target roles:</span>
          <div class="flex gap-sm flex-wrap">
            @for (role of roles(); track role.id) {
              <label class="flex items-center gap-xs text-sm">
                <input
                  type="checkbox"
                  [checked]="inj.target_roles.includes(role.id)"
                  (change)="toggleRole(i, role.id, $event)"
                />
                {{ role.label }}
              </label>
            }
          </div>
        </div>
      </div>
    } @empty {
      <p class="text-muted-foreground text-sm p-sm">No injects yet.</p>
    }

    <button
      uiButton
      variant="outline"
      size="sm"
      class="mt-sm"
      (click)="addInject()"
    >
      + Add Inject
    </button>
  `,
})
export class TurnInjectEditorComponent {
  private readonly store = inject(ScenarioBuilderStore);

  injects = input.required<TurnInjectDef[]>();
  roles = input.required<{ id: string; label: string }[]>();
  turnIndex = input.required<number>();

  protected roleLabel(roleId: string): string {
    const found = this.roles().find((r) => r.id === roleId);
    return found ? found.label : roleId;
  }

  protected addInject(): void {
    this.store.addInjectToTurn(this.turnIndex(), {
      target_roles: [],
      text: "",
      role_descriptions: {},
    });
  }

  protected removeInject(injectIndex: number): void {
    this.store.removeInjectFromTurn(this.turnIndex(), injectIndex);
  }

  protected updateText(injectIndex: number, event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      this.store.updateInjectInTurn(this.turnIndex(), injectIndex, {
        text: target.value,
      });
    }
  }

  protected toggleRole(
    injectIndex: number,
    roleId: string,
    event: Event,
  ): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const current = this.injects()[injectIndex].target_roles;
    const updated = target.checked
      ? [...current, roleId]
      : current.filter((r) => r !== roleId);
    this.store.updateInjectInTurn(this.turnIndex(), injectIndex, {
      target_roles: updated,
    });
  }
}
