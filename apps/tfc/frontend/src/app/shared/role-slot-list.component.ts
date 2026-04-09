import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { BadgeComponent, ButtonDirective } from "@aspect/ui";
import type { RoleDef } from "../core/scenario-api.service";
import type { ParticipantResponse } from "../core/waiting-room-api.service";

@Component({
  selector: "tfc-role-slot-list",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ButtonDirective],
  template: `
    <div class="crew-stations">
      @for (role of roles(); track role.id) {
        @let holder = holderOf(role.id);
        <div
          class="crew-station"
          [attr.data-filled]="holder ? '' : null"
          [attr.data-self]="holder?.id === currentParticipantId() ? '' : null"
        >
          <div class="crew-station__info">
            <span
              class="crew-station__light"
              [attr.data-active]="holder ? '' : null"
            ></span>
            <span class="crew-station__role">{{ role.label }}</span>
            <span class="crew-station__type">
              {{ role.player_type === "decision_maker" ? "CMD" : "ADV" }}
            </span>
          </div>
          @if (holder) {
            <div class="flex items-center gap-sm">
              <span class="text-sm">{{ holder.display_name }}</span>
              @if (holder.id === currentParticipantId()) {
                <ui-badge variant="secondary">You</ui-badge>
              }
            </div>
          } @else if (currentParticipantId()) {
            <button
              uiButton
              variant="outline"
              size="sm"
              (click)="claimed.emit(role.id)"
            >
              Claim
            </button>
          } @else {
            <span class="text-sm text-muted-foreground">Open</span>
          }
        </div>
      }
      @if (showGmSlot()) {
        @let gmHolder = holderOf("trainer");
        <div
          class="crew-station"
          [attr.data-filled]="gmHolder ? '' : null"
          [attr.data-self]="gmHolder?.id === currentParticipantId() ? '' : null"
        >
          <div class="crew-station__info">
            <span
              class="crew-station__light"
              [attr.data-active]="gmHolder ? '' : null"
            ></span>
            <span class="crew-station__role">Trainer</span>
            <span class="crew-station__type">TRN</span>
          </div>
          @if (gmHolder) {
            <div class="flex items-center gap-sm">
              <span class="text-sm">{{ gmHolder.display_name }}</span>
              @if (gmHolder.id === currentParticipantId()) {
                <ui-badge variant="secondary">You</ui-badge>
              }
            </div>
          } @else if (currentParticipantId()) {
            <button
              uiButton
              variant="outline"
              size="sm"
              (click)="claimed.emit('trainer')"
            >
              Claim
            </button>
          } @else {
            <span class="text-sm text-muted-foreground">Open</span>
          }
        </div>
      }
    </div>
  `,
})
export class RoleSlotListComponent {
  readonly roles = input.required<RoleDef[]>();
  readonly participants = input.required<ParticipantResponse[]>();
  readonly currentParticipantId = input.required<string>();
  readonly showGmSlot = input(false);
  readonly claimed = output<string>();

  protected holderOf(roleId: string): ParticipantResponse | undefined {
    return this.participants().find((p) => p.role === roleId);
  }
}
