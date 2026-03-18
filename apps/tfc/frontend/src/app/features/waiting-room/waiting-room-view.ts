import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CardComponent,
  BadgeComponent,
  ButtonDirective,
} from '@aspect/ui';
import { ExerciseWsService } from '../../core/exercise-ws.service';
import { ExerciseApiService } from '../../core/exercise-api.service';
import {
  ScenarioApiService,
  type RoleDef,
} from '../../core/scenario-api.service';
import {
  WaitingRoomApiService,
  type ParticipantResponse,
} from '../../core/waiting-room-api.service';
import { Subscription } from 'rxjs';

const DEFAULT_ROLES: RoleDef[] = [
  { id: 'player', label: 'Player', player_type: 'advisor' },
  { id: 'observer', label: 'Observer', player_type: 'advisor' },
  { id: 'game-master', label: 'Game Master', player_type: 'decision_maker' },
];

@Component({
  selector: 'tfc-waiting-room-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, BadgeComponent, ButtonDirective],
  template: `
    <div class="flex justify-center items-center min-h-screen p-lg">
      <ui-card title="Waiting Room">
        <div class="flex flex-col gap-md" style="min-width: 420px; max-width: 600px;">
          <p class="text-sm text-muted-foreground">
            @if (isSimpleCollaborative()) {
              Collaborative exercise — no facilitator needed.
              Pick a role and start when all slots are filled.
            } @else {
              Assign roles before starting.
            }
          </p>

          @if (scenarioRoles().length) {
            <div class="flex flex-col gap-sm">
              @for (role of scenarioRoles(); track role.id) {
                @let holder = holderOf(role.id);
                <div class="flex items-center justify-between p-sm border-b gap-md">
                  <div class="flex items-center gap-sm">
                    <span class="text-sm font-medium">{{ role.label }}</span>
                    <span class="text-xs text-muted-foreground">
                      {{ role.player_type === 'decision_maker' ? 'Decision Maker' : 'Advisor' }}
                    </span>
                  </div>
                  @if (holder) {
                    <div class="flex items-center gap-sm">
                      <span class="text-sm">{{ holder.display_name }}</span>
                      @if (holder.id === participantId()) {
                        <ui-badge variant="secondary">You</ui-badge>
                      }
                    </div>
                  } @else if (participantId()) {
                    <button
                      uiButton variant="outline"
                      style="font-size: var(--font-size-xs); padding: var(--spacing-xs) var(--spacing-sm);"
                      (click)="onClaimRole(role.id)"
                    >
                      Claim
                    </button>
                  } @else {
                    <span class="text-sm text-muted-foreground">Open</span>
                  }
                </div>
              }

              @if (requiresGm()) {
                @let gmHolder = holderOf('game-master');
                <div class="flex items-center justify-between p-sm border-b gap-md">
                  <div class="flex items-center gap-sm">
                    <span class="text-sm font-medium">Game Master (Trainer)</span>
                    <span class="text-xs text-muted-foreground">Facilitator</span>
                  </div>
                  @if (gmHolder) {
                    <div class="flex items-center gap-sm">
                      <span class="text-sm">{{ gmHolder.display_name }}</span>
                      @if (gmHolder.id === participantId()) {
                        <ui-badge variant="secondary">You</ui-badge>
                      }
                    </div>
                  } @else if (participantId()) {
                    <button
                      uiButton variant="outline"
                      style="font-size: var(--font-size-xs); padding: var(--spacing-xs) var(--spacing-sm);"
                      (click)="onClaimRole('game-master')"
                    >
                      Claim
                    </button>
                  } @else {
                    <span class="text-sm text-muted-foreground">Open</span>
                  }
                </div>
              }
            </div>
          } @else {
            <div class="flex flex-col gap-sm">
              @for (p of participants(); track p.id) {
                <div class="flex items-center justify-between p-sm border-b gap-md">
                  <div class="flex items-center gap-sm">
                    <span class="text-sm font-medium">{{ p.display_name }}</span>
                    @if (p.id === participantId()) {
                      <ui-badge variant="secondary">You</ui-badge>
                    }
                  </div>
                  <select
                    class="input-base"
                    [value]="p.role"
                    (change)="onRoleChange(p.id, $event)"
                  >
                    @for (role of fallbackRoles; track role.id) {
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
          }

          <div class="flex gap-sm justify-end">
            <button uiButton variant="outline" (click)="onLeave()">Leave</button>
            <button
              uiButton variant="default"
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
  protected readonly participantId = signal('');
  protected readonly participants = signal<ParticipantResponse[]>([]);
  protected readonly gameMode = signal('classic');
  protected readonly scenarioRoles = signal<RoleDef[]>([]);
  protected readonly requiresGm = signal(false);
  protected readonly fallbackRoles = DEFAULT_ROLES;

  protected readonly isSimpleCollaborative = computed(
    () => this.gameMode() === 'simple_collaborative',
  );

  protected readonly canStart = computed(() => {
    const roles = this.scenarioRoles();
    if (roles.length) {
      const requiredCount = roles.length + (this.requiresGm() ? 1 : 0);
      return this.participants().length >= requiredCount;
    }
    if (this.isSimpleCollaborative()) {
      return this.participants().length > 0;
    }
    return this.participants().some(
      (p) => p.id === this.participantId() && p.role === 'game-master',
    );
  });

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const eId = Number(params['exerciseId'] ?? 0);
    const pId = String(params['participantId'] ?? '');
    const gm = String(params['gameMode'] ?? 'classic');
    this.exerciseId.set(eId);
    this.participantId.set(pId);
    this.gameMode.set(gm);

    this.ws.connect(eId, 'player');
    this.sub = this.ws.messages$.subscribe((msg) => {
      if (msg.type === 'waiting_room_update') {
        const updated = msg['participants'] as ParticipantResponse[];
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
    this.api
      .leave(this.exerciseId(), this.participantId())
      .subscribe({
        next: () => this.router.navigate(['/join']),
        error: () => this.router.navigate(['/join']),
      });
  }

  protected onStartExercise(): void {
    const me = this.participants().find(
      (p) => p.id === this.participantId(),
    );
    const role = me?.role ?? 'player';
    if (this.isSimpleCollaborative()) {
      this.router.navigate(['/player'], {
        queryParams: {
          exerciseId: this.exerciseId(),
          participantId: this.participantId(),
          role,
        },
      });
      return;
    }
    const isGm = role === 'game-master';
    const route = isGm ? '/gm' : '/player';
    this.router.navigate([route], {
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
        this.requiresGm.set(exercise.game_mode === 'classic');
        if (exercise.scenario_id) {
          this.scenarioApi.get(exercise.scenario_id).subscribe({
            next: (scenario) => {
              const roles = scenario.content?.roles ?? [];
              this.scenarioRoles.set(roles);
            },
          });
        }
      },
    });
  }
}
