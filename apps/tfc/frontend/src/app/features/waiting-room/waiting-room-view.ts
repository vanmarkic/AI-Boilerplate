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
import { BadgeComponent, ButtonDirective, InputComponent } from "@aspect/ui";
import { FormsModule } from "@angular/forms";
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
import { SeaBackdrop } from "../home/sea-backdrop";
import { TwoPlayerStations } from "./two-player-stations";
import { Subscription } from "rxjs";

type PlayerCountMode = "full" | "two_player" | "practice";

@Component({
  selector: "tfc-waiting-room-view",
  host: { class: "wr-host" },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    BadgeComponent,
    ButtonDirective,
    InputComponent,
    RoleSlotListComponent,
    SeaBackdrop,
    TwoPlayerStations,
  ],
  template: `
    <tfc-sea-backdrop />
    <div class="flex justify-center items-center min-h-screen p-lg relative" style="z-index: 1;">
      <div class="cmd-panel">
        <div class="cmd-panel__header">
          <span class="cmd-panel__title">Operations Lobby</span>
          <span class="session-code">EX-{{ exerciseId() }}</span>
        </div>
        <div class="cmd-panel__body flex flex-col gap-md">
          @if (!participantId()) {
            <div class="flex flex-col gap-sm">
              <p class="wr-join__prompt">// Enter callsign to join operations</p>
              <div class="flex gap-sm items-end">
                <ui-input
                  id="wr-name"
                  label="Callsign"
                  placeholder="Enter your name"
                  [(value)]="displayName"
                  style="flex: 1;"
                />
                <button
                  uiButton variant="default"
                  [disabled]="!displayName().trim() || joining()"
                  (click)="onJoin()"
                >
                  {{ joining() ? "Joining..." : "Join" }}
                </button>
              </div>
            </div>
          }

          <p class="wr-join__prompt">
            @if (isSimpleCollaborative()) {
              // Collaborative exercise — no facilitator needed.
              @if (practiceMode()) {
                Practice mode: you'll handle all roles solo.
              } @else if (twoPlayerMode()) {
                2-Player mode: assign CO and Crew roles.
              } @else {
                Pick a station and deploy when all slots are filled.
              }
            } @else {
              // Assign stations before deploying.
            }
          </p>

          @if (isSimpleCollaborative()) {
            <div class="flex gap-sm items-center">
              <span class="wr-mode-bar__label">Players:</span>
              <div class="flex gap-xs">
                @for (m of modes; track m.key) {
                  <button uiButton
                    [variant]="playerCountMode() === m.key ? 'default' : 'outline'"
                    size="sm" (click)="onPlayerCountMode(m.key)">
                    {{ m.label }}
                  </button>
                }
              </div>
            </div>
          }

          @if (practiceMode()) {
            <div class="crew-stations">
              <p class="wr-join__prompt">// Solo simulation — all stations active</p>
              @if (participants().length) {
                <div class="crew-station" data-filled data-self>
                  <div class="crew-station__info">
                    <span class="crew-station__light" data-active></span>
                    <span class="crew-station__role">{{ participants()[0].display_name }}</span>
                    <ui-badge variant="secondary">You</ui-badge>
                  </div>
                  <span class="crew-station__type">ALL</span>
                </div>
              }
            </div>
          } @else if (twoPlayerMode()) {
            <tfc-two-player-stations
              [roles]="scenarioRoles()"
              [participants]="participants()"
              [currentParticipantId]="participantId()"
              (roleChanged)="onTwoPlayerRoleChange($event)"
            />
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
              Scenario has no roles defined.
            </p>
          }

          @if (participantId()) {
            <div class="readiness-gauge">
              <span class="readiness-gauge__label">Readiness</span>
              <div class="readiness-gauge__track">
                <div class="readiness-gauge__fill"
                  [style.width.%]="readinessPercent()"></div>
              </div>
              <span class="readiness-gauge__label">
                {{ participants().length }}/{{ maxSlots() }}
              </span>
            </div>
            <div class="wr-actions">
              <button uiButton variant="outline" (click)="onLeave()">Leave</button>
              <button uiButton variant="default"
                [disabled]="!canStart()" (click)="onStartExercise()">
                Deploy ({{ participants().length }})
              </button>
            </div>
          }
        </div>
      </div>
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
  protected readonly playerCountMode = signal<PlayerCountMode>("full");
  protected readonly scenarioRoles = signal<RoleDef[]>([]);
  protected readonly requiresGm = signal(false);
  protected readonly displayName = signal("");
  protected readonly joining = signal(false);

  protected readonly modes: { key: PlayerCountMode; label: string }[] = [
    { key: "full", label: "Full Team" },
    { key: "two_player", label: "2 Players" },
    { key: "practice", label: "Practice" },
  ];

  protected readonly isSimpleCollaborative = computed(
    () => this.gameMode() === "simple_collaborative",
  );
  protected readonly twoPlayerMode = computed(
    () => this.playerCountMode() === "two_player",
  );
  protected readonly practiceMode = computed(
    () => this.playerCountMode() === "practice",
  );

  protected readonly maxSlots = computed(() => {
    if (this.practiceMode()) return 1;
    if (this.twoPlayerMode()) return 2;
    const roles = this.scenarioRoles();
    return roles.length + (this.requiresGm() ? 1 : 0);
  });

  protected readonly readinessPercent = computed(() => {
    const max = this.maxSlots();
    return max > 0 ? (this.participants().length / max) * 100 : 0;
  });

  protected readonly canStart = computed(() => {
    const roles = this.scenarioRoles();
    if (!roles.length) return false;
    if (this.practiceMode()) return this.participants().length === 1;
    if (this.twoPlayerMode()) {
      const pRoles = this.participants().map((p) => p.role);
      return (
        this.participants().length === 2 &&
        pRoles.includes("decision_maker") &&
        pRoles.includes("all_advisors")
      );
    }
    return this.participants().length >= this.maxSlots();
  });

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const eId = Number(params["exerciseId"] ?? 0);
    const pId = String(params["participantId"] ?? "");
    this.exerciseId.set(eId);
    this.participantId.set(pId);
    this.ws.connect(eId, "player");
    this.sub = this.ws.messages$.subscribe((msg) => {
      if (msg.type === "waiting_room_update") {
        if (msg.participants) this.participants.set(msg.participants);
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

  protected onPlayerCountMode(mode: PlayerCountMode): void {
    this.playerCountMode.set(mode);
  }

  protected onJoin(): void {
    const name = this.displayName().trim();
    if (!name) return;
    this.joining.set(true);
    this.api.join(this.exerciseId(), name, "player").subscribe({
      next: (p) => {
        this.participantId.set(p.id);
        this.joining.set(false);
      },
      error: () => this.joining.set(false),
    });
  }

  protected onClaimRole(roleId: string): void {
    this.api
      .updateRole(this.exerciseId(), this.participantId(), roleId)
      .subscribe();
  }

  protected onTwoPlayerRoleChange(ev: { targetId: string; roleId: string }): void {
    this.api.updateRole(this.exerciseId(), ev.targetId, ev.roleId).subscribe();
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
          gameMode: "simple_collaborative",
          practiceMode: this.practiceMode(),
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
