import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { SystemSnapshot } from "../core/generated/state-changes.types";
@Component({
  selector: "tfc-system-status-board",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (systems().length > 0) {
      <div class="system-board">
        <span class="system-board__title">Systems</span>
        <div class="system-board__chips">
          @for (sys of systems(); track sys.system_id) {
            <span
              class="system-chip"
              data-testid="system-row"
              [attr.data-power]="sys.power"
              [attr.data-operational]="sys.operational"
              [attr.data-category]="sys.category"
            >
              <span class="system-chip__label">{{ sys.label }}</span>
              <span class="system-chip__power">{{
                sys.power ? "ON" : "OFF"
              }}</span>
              <span class="system-chip__traffic">
                <span class="system-chip__light" data-color="red"></span>
                @if (sys.category !== "weapon") {
                  <span class="system-chip__light" data-color="yellow"></span>
                }
                <span class="system-chip__light" data-color="green"></span>
              </span>
            </span>
          }
        </div>
      </div>
    }
  `,
})
export class SystemStatusBoardComponent {
  readonly systems = input<SystemSnapshot[]>([]);
}
