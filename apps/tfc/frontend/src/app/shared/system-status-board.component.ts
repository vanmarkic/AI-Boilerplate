import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { SystemSnapshot } from "../core/generated/state-changes.types";

@Component({
  selector: "tfc-system-status-board",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (systems().length > 0) {
      <div class="system-board">
        <div class="system-board__title">Systems</div>
        @for (sys of systems(); track sys.system_id) {
          <div
            class="system-row"
            data-testid="system-row"
            [attr.data-power]="sys.power"
            [attr.data-operational]="sys.operational"
          >
            <span class="system-row__label">{{ sys.label }}</span>
            <span class="system-row__power">{{ sys.power ? "ON" : "OFF" }}</span>
            <span class="system-row__status"></span>
          </div>
        }
      </div>
    }
  `,
})
export class SystemStatusBoardComponent {
  readonly systems = input<SystemSnapshot[]>([]);
}
