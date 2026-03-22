import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { WarfareDomainSnapshot } from "../core/generated/state-changes.types";
@Component({
  selector: "tfc-warfare-domain-board",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (domains().length > 0) {
      <div class="warfare-board">
        <span class="warfare-board__title">Warfare</span>
        <div class="warfare-board__chips">
          @for (domain of domains(); track domain.domain_id) {
            <span
              class="warfare-chip"
              data-testid="domain-row"
              [attr.data-threat]="domain.threat_level"
            >
              <span class="warfare-chip__label">{{ domain.label }}</span>
              <span class="warfare-chip__traffic">
                <span class="warfare-chip__light" data-color="red"></span>
                <span class="warfare-chip__light" data-color="yellow"></span>
                <span class="warfare-chip__light" data-color="green"></span>
              </span>
            </span>
          }
        </div>
      </div>
    }
  `,
})
export class WarfareDomainBoardComponent {
  readonly domains = input<WarfareDomainSnapshot[]>([]);
}
