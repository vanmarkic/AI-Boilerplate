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
    <div class="flex flex-col gap-sm">
      @for (role of roles(); track role.id) {
        @let holder = holderOf(role.id);
        <div class="flex items-center justify-between p-sm border-b gap-md">
          <div class="flex items-center gap-sm">
            <span class="text-sm font-medium">{{ role.label }}</span>
            <span class="text-xs text-muted-foreground">
              {{
                role.player_type === "decision_maker"
                  ? "Decision Maker"
                  : "Advisor"
              }}
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
              style="font-size: var(--font-size-xs); padding: var(--spacing-xs) var(--spacing-sm);"
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
        @let gmHolder = holderOf("game-master");
        <div class="flex items-center justify-between p-sm border-b gap-md">
          <div class="flex items-center gap-sm">
            <span class="text-sm font-medium">Game Master (Trainer)</span>
            <span class="text-xs text-muted-foreground">Facilitator</span>
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
              style="font-size: var(--font-size-xs); padding: var(--spacing-xs) var(--spacing-sm);"
              (click)="claimed.emit('game-master')"
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
