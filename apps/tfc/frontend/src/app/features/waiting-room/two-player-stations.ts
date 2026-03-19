import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { BadgeComponent } from "@aspect/ui";
import type { ParticipantResponse } from "../../core/waiting-room-api.service";
import type { RoleDef } from "../../core/scenario-api.service";

const TWO_PLAYER_ROLES = [
  { id: "decision_maker", label: "Commanding Officer" },
  { id: "all_advisors", label: "Crew Members" },
];

@Component({
  selector: "tfc-two-player-stations",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `
    <div class="flex flex-col gap-md">
      <div class="crew-stations">
        <span class="wr-join__prompt">// Scenario stations</span>
        @for (role of roles(); track role.id) {
          <div class="crew-station">
            <div class="crew-station__info">
              <span class="crew-station__light"></span>
              <span class="crew-station__role">{{ role.label }}</span>
            </div>
            <span class="crew-station__type">
              {{ role.player_type === "decision_maker" ? "CMD" : "ADV" }}
            </span>
          </div>
        }
      </div>
      <div class="crew-stations">
        <span class="wr-join__prompt">// Crew assignment</span>
        @for (p of participants(); track p.id) {
          <div
            class="crew-station"
            data-filled
            [attr.data-self]="p.id === currentParticipantId() ? '' : null"
          >
            <div class="crew-station__info">
              <span class="crew-station__light" data-active></span>
              <span class="crew-station__role">{{ p.display_name }}</span>
              @if (p.id === currentParticipantId()) {
                <ui-badge variant="secondary">You</ui-badge>
              }
            </div>
            <select
              class="input-base"
              [value]="p.role"
              (change)="onRoleChange(p.id, $event)"
            >
              @for (role of twoPlayerRoles; track role.id) {
                <option [value]="role.id">{{ role.label }}</option>
              }
            </select>
          </div>
        } @empty {
          <p class="wr-join__prompt">// Awaiting crew...</p>
        }
      </div>
    </div>
  `,
})
export class TwoPlayerStations {
  readonly roles = input.required<RoleDef[]>();
  readonly participants = input.required<ParticipantResponse[]>();
  readonly currentParticipantId = input.required<string>();
  readonly roleChanged = output<{ targetId: string; roleId: string }>();

  protected readonly twoPlayerRoles = TWO_PLAYER_ROLES;

  protected onRoleChange(targetId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    this.roleChanged.emit({ targetId, roleId: target.value });
  }
}
