import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from "@angular/core";
import { Router } from "@angular/router";
import { BadgeComponent, ButtonDirective } from "@aspect/ui";
import type { ParticipantResponse } from "../../core/waiting-room-api.service";
import type { RoleDef } from "../../core/scenario-api.service";

export interface JoinableExercise {
  exercise: {
    id: number;
    title: string;
    game_mode: string;
    scenario_id: number | null;
    player_count_mode: string;
  };
  participants: ParticipantResponse[];
  roles: RoleDef[];
  max_players: number;
  requires_gm: boolean;
  player_count_mode: string;
}

@Component({
  selector: "tfc-lobby-preview",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ButtonDirective],
  styleUrl: "./lobby-preview.css",
  template: `
    <div class="tac-panel">
      <div class="lobby-op-header">
        <span>Active Operation</span>
        <span class="lobby-op-status">
          <span class="lobby-op-status__light"></span>
          Live
        </span>
      </div>

      <span class="tac-panel__label">{{ data().exercise.title }}</span>

      <p class="text-sm text-muted-foreground">
        {{ data().participants.length }} / {{ data().max_players }} crew
      </p>

      <div class="crew-stations">
        @for (role of data().roles; track role.id) {
          @let holder = holderOf(role.id);
          <div class="crew-station" [attr.data-filled]="holder ? '' : null">
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
              <ui-badge variant="outline">{{ holder.display_name }}</ui-badge>
            } @else {
              <span class="text-sm text-muted-foreground">Open</span>
            }
          </div>
        }

        @if (data().requires_gm) {
          @let gmHolder = holderOf("game-master");
          <div class="crew-station" [attr.data-filled]="gmHolder ? '' : null">
            <div class="crew-station__info">
              <span
                class="crew-station__light"
                [attr.data-active]="gmHolder ? '' : null"
              ></span>
              <span class="crew-station__role">Game Master</span>
              <span class="crew-station__type">GM</span>
            </div>
            @if (gmHolder) {
              <ui-badge variant="outline">{{ gmHolder.display_name }}</ui-badge>
            } @else {
              <span class="text-sm text-muted-foreground">Open</span>
            }
          </div>
        }
      </div>

      <button uiButton variant="default" (click)="onJoin()">
        Join Operation
      </button>
    </div>
  `,
})
export class LobbyPreview {
  private readonly router = inject(Router);

  readonly data = input.required<JoinableExercise>();

  protected holderOf(roleId: string): ParticipantResponse | undefined {
    return this.data().participants.find(
      (p: ParticipantResponse) => p.role === roleId,
    );
  }

  protected onJoin(): void {
    const d = this.data();
    this.router.navigate(["/waiting-room"], {
      queryParams: {
        exerciseId: d.exercise.id,
        gameMode: d.exercise.game_mode,
        playerCountMode: d.player_count_mode ?? "full",
      },
    });
  }
}
