import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { CardComponent, BadgeComponent, ButtonDirective } from "@aspect/ui";
import { ExerciseWsService } from "../../core/exercise-ws.service";
import { ExerciseApiService } from "../../core/exercise-api.service";
import {
  ScenarioApiService,
  type RoleDef,
} from "../../core/scenario-api.service";
import {
  WaitingRoomApiService,
  type ParticipantResponse,
} from "../../core/waiting-room-api.service";
import { RoleSlotListComponent } from "../../shared/role-slot-list.component";
import { Subscription } from "rxjs";

const TWO_PLAYER_ROLES = [
  { id: "decision_maker", label: "Decision Maker" },
  { id: "all_advisors", label: "All Advisors" },
];

@Component({
  selector: "tfc-waiting-room-view",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    BadgeComponent,
    ButtonDirective,
    RoleSlotListComponent,
  ],
  template: `
    <div class="flex justify-center items-center min-h-screen p-lg">
      <ui-card title="Waiting Room">
        <div
          class="flex flex-col gap-md"
          style="min-width: var(--container-md); max-width: var(--container-2xl);"
        >
          <p class="text-sm text-muted-foreground">
            @if (isSimpleCollaborative()) {
              Collaborative exercise — no facilitator needed.
              @if (twoPlayerMode()) {
                2 Player Mode: assign Decision Maker and All Advisors roles.
              } @else {
                Pick a role and start when all slots are filled.
              }
            } @else {
              Assign roles before starting.
            }
          </p>

          @if (isSimpleCollaborative()) {
            <label class="flex items-center gap-sm text-sm">
              <input
                type="checkbox"
                [checked]="twoPlayerMode()"
                (change)="onToggleTwoPlayer()"
              />
              2 Player Mode
            </label>
          }

          @if (twoPlayerMode()) {
            <div class="flex flex-col gap-sm">
              @for (p of participants(); track p.id) {
                <div
                  class="flex items-center justify-between p-sm border-b gap-md"
                >
                  <div class="flex items-center gap-sm">
                    <span class="text-sm font-medium">{{
                      p.display_name
                    }}</span>
                    @if (p.id === participantId()) {
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
                <p class="text-muted-foreground text-sm p-sm">
                  No participants yet.
                </p>
              }
            </div>
          } @else if (scenarioRoles().length) {
            <tfc-role-slot-list
              [roles]="scenarioRoles()"
              [participants]="participants()"
              [currentParticipantId]="participantId()"
              [showGmSlot]="requiresGm()"
              (claimed)="onClaimRole($event)"
            />
          } @else {
            <p class="text-sm text-destructive p-sm">
              Scenario has no roles defined. The exercise cannot start until the
              scenario is updated with at least one decision-maker and one
              advisor role.
            </p>
          }

          <div class="flex gap-sm justify-end">
            <button uiButton variant="outline" (click)="onLeave()">
              Leave
            </button>
            <button
              uiButton
              variant="default"
              [disabled]="!canStart()"
              (click)="onStartExercise()"
            >
              Start Exercise ({{ participants().length }})
            </button>
          </div>
        </div>
      </ui-card>
    </div>
  `,
})
export class WaitingRoomView implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(WaitingRoomApiService);
  private readonly ws = inject(ExerciseWsService);
  private readonly exerciseApi = inject(ExerciseApiService);
  private readonly scenarioApi = inject(ScenarioApiService);
  private sub: Subscription | null = null;

  protected readonly exerciseId = signal(0);
  protected readonly participantId = signal("");
  protected readonly participants = signal<ParticipantResponse[]>([]);
  protected readonly gameMode = signal("classic");
  protected readonly twoPlayerMode = signal(false);
  protected readonly scenarioRoles = signal<RoleDef[]>([]);
  protected readonly requiresGm = signal(false);
  protected readonly twoPlayerRoles = TWO_PLAYER_ROLES;

  protected readonly isSimpleCollaborative = computed(
    () => this.gameMode() === "simple_collaborative",
  );

  protected readonly canStart = computed(() => {
    const roles = this.scenarioRoles();
    if (!roles.length) return false;
    if (this.twoPlayerMode()) {
      const pRoles = this.participants().map((p) => p.role);
      return (
        this.participants().length === 2 &&
        pRoles.includes("decision_maker") &&
        pRoles.includes("all_advisors")
      );
    }
    const requiredCount = roles.length + (this.requiresGm() ? 1 : 0);
    return this.participants().length >= requiredCount;
  });

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const eId = Number(params["exerciseId"] ?? 0);
    const pId = String(params["participantId"] ?? "");
    const gm = String(params["gameMode"] ?? "classic");
    this.exerciseId.set(eId);
    this.participantId.set(pId);
    this.gameMode.set(gm);
    this.ws.connect(eId, "player");
    this.sub = this.ws.messages$.subscribe((msg) => {
      if (msg.type === "waiting_room_update") {
        const updated = msg["participants"] as ParticipantResponse[];
        if (updated) this.participants.set(updated);
      }
    });
    this.api.listParticipants(eId).subscribe({
      next: (res) => this.participants.set(res.participants),
    });
    this.loadScenarioRoles(eId);
  }

  ngOnDestroy(): void {
    this.ws.disconnect();
    this.sub?.unsubscribe();
  }

  protected onToggleTwoPlayer(): void {
    this.twoPlayerMode.set(!this.twoPlayerMode());
  }

  protected holderOf(roleId: string): ParticipantResponse | undefined {
    return this.participants().find((p) => p.role === roleId);
  }

  protected onClaimRole(roleId: string): void {
    this.api
      .updateRole(this.exerciseId(), this.participantId(), roleId)
      .subscribe();
  }

  protected onRoleChange(targetId: string, event: Event): void {
    const role = (event.target as HTMLSelectElement).value;
    this.api.updateRole(this.exerciseId(), targetId, role).subscribe();
  }

  protected onLeave(): void {
    this.api.leave(this.exerciseId(), this.participantId()).subscribe({
      next: () => this.router.navigate(["/home"]),
      error: () => this.router.navigate(["/home"]),
    });
  }

  protected onStartExercise(): void {
    const me = this.participants().find((p) => p.id === this.participantId());
    const role = me?.role ?? "player";
    if (this.isSimpleCollaborative()) {
      this.router.navigate(["/player"], {
        queryParams: {
          exerciseId: this.exerciseId(),
          participantId: this.participantId(),
          role,
        },
      });
      return;
    }
    const isGm = role === "game-master";
    this.router.navigate([isGm ? "/gm" : "/player"], {
      queryParams: {
        exerciseId: this.exerciseId(),
        participantId: this.participantId(),
        role,
      },
    });
  }

  private loadScenarioRoles(exerciseId: number): void {
    this.exerciseApi.get(exerciseId).subscribe({
      next: (exercise) => {
        this.gameMode.set(exercise.game_mode);
        this.requiresGm.set(exercise.game_mode === "classic");
        if (exercise.scenario_id) {
          this.scenarioApi.get(exercise.scenario_id).subscribe({
            next: (scenario) =>
              this.scenarioRoles.set(scenario.content?.roles ?? []),
          });
        }
      },
    });
  }
}
