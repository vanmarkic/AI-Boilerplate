import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from "@angular/core";
import { Router } from "@angular/router";
import {
  BadgeComponent,
  ButtonDirective,
  CardComponent,
} from "@aspect/ui";
import type { ParticipantResponse } from "../../core/waiting-room-api.service";
import type { RoleDef } from "../../core/scenario-api.service";

export interface JoinableExercise {
  exercise: {
    id: number;
    title: string;
    game_mode: string;
    scenario_id: number | null;
  };
  participants: ParticipantResponse[];
  roles: RoleDef[];
  max_players: number;
  requires_gm: boolean;
}

@Component({
  selector: "tfc-lobby-preview",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, BadgeComponent, ButtonDirective],
  styleUrl: "./lobby-preview.css",
  template: `
    <ui-card [title]="data().exercise.title">
      <div class="flex flex-col gap-md">
        <p class="text-sm text-muted-foreground">
          {{ data().participants.length }} / {{ data().max_players }} players
        </p>

        <div class="role-slots">
          @for (role of data().roles; track role.id) {
            @let holder = holderOf(role.id);
            <div class="role-slot" [attr.data-taken]="holder ? '' : null">
              <div>
                <span class="role-label">{{ role.label }}</span>
                <span class="role-type">
                  {{
                    role.player_type === "decision_maker"
                      ? "Decision Maker"
                      : "Advisor"
                  }}
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
            <div class="role-slot" [attr.data-taken]="gmHolder ? '' : null">
              <div>
                <span class="role-label">Game Master (Trainer)</span>
                <span class="role-type">Facilitator</span>
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
          Join Exercise
        </button>
      </div>
    </ui-card>
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
      },
    });
  }
}
