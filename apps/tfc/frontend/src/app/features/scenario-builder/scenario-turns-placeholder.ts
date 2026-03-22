import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { CardComponent, BadgeComponent } from "@aspect/ui";
import { ScenarioBuilderStore } from "./scenario-builder.store";

@Component({
  selector: "tfc-scenario-turns-placeholder",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, BadgeComponent],
  template: `
    <ui-card title="Turns">
      @if ((store.content().turns ?? []).length > 0) {
        @for (turn of store.content().turns ?? []; track turn.turn_index) {
          <div class="flex items-center gap-sm p-sm border-b">
            <ui-badge variant="secondary">{{ turn.turn_index }}</ui-badge>
            <span class="text-sm font-medium">{{
              turn.title || "Turn " + turn.turn_index
            }}</span>
            @if (turn.base_stress_delta !== 0) {
              <span class="text-xs text-muted-foreground">
                stress: {{ turn.base_stress_delta > 0 ? "+" : ""
                }}{{ turn.base_stress_delta }}
              </span>
            }
            @for (injectId of turn.inject_ids; track injectId) {
              <ui-badge variant="outline">{{ injectId }}</ui-badge>
            }
          </div>
        }
      } @else {
        <p class="text-muted-foreground text-sm p-sm">
          No turns defined. Turns group injects and decisions into sequential
          steps.
        </p>
      }
    </ui-card>
  `,
})
export class ScenarioTurnsPlaceholderComponent {
  protected readonly store = inject(ScenarioBuilderStore);
}
