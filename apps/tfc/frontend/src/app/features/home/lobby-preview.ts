import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  BadgeComponent,
  ButtonDirective,
  CardComponent,
  InputComponent,
} from '@aspect/ui';
import { ExerciseWsService } from '../../core/exercise-ws.service';
import {
  WaitingRoomApiService,
  type ParticipantResponse,
} from '../../core/waiting-room-api.service';
import { EngineApiService } from '../../core/engine-api.service';
import type { RoleDef } from '../../core/scenario-api.service';
import { Subscription } from 'rxjs';

export interface JoinableExercise {
  exercise: {
    id: number; title: string; game_mode: string; scenario_id: number | null;
  };
  participants: ParticipantResponse[];
  roles: RoleDef[];
  max_players: number;
  requires_gm: boolean;
}

@Component({
  selector: 'tfc-lobby-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CardComponent, BadgeComponent, ButtonDirective, InputComponent],
  styles: [`
    :host { display: block; width: 100%; max-width: 560px; }

    .role-slots {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }

    .role-slot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-sm) var(--spacing-md);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md, 0.5rem);
      font-size: var(--font-size-sm, 0.875rem);
      transition: border-color 0.15s, background 0.15s;
    }

    .role-slot[data-available] {
      cursor: pointer;
    }

    .role-slot[data-available]:hover {
      border-color: var(--color-primary);
      background: color-mix(in oklch, var(--glass-bg) 85%, var(--color-primary) 15%);
    }

    .role-slot[data-taken] {
      background: color-mix(in oklch, var(--glass-bg) 90%, var(--color-muted-foreground) 10%);
    }

    .role-slot[data-mine] {
      border-color: var(--color-primary);
      background: color-mix(in oklch, var(--glass-bg) 80%, var(--color-primary) 20%);
    }

    .role-label { font-weight: 500; }
    .role-type {
      font-size: var(--font-size-xs, 0.75rem);
      color: var(--color-muted-foreground);
    }

    .join-form {
      display: flex;
      gap: var(--spacing-sm);
      align-items: flex-end;
    }

    .lobby-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  `],
  template: `
    <ui-card [title]="data().exercise.title">
      <div class="flex flex-col gap-md">
        <div class="lobby-header">
          <p class="text-sm text-muted-foreground">
            {{ participants().length }} / {{ data().max_players }} players
          </p>
          @if (myParticipantId()) {
            <ui-badge variant="secondary">Joined</ui-badge>
          }
        </div>

        <div class="role-slots">
          @for (role of data().roles; track role.id) {
            @let holder = holderOf(role.id);
            <div
              class="role-slot"
              [attr.data-taken]="holder && holder.id !== myParticipantId() ? '' : null"
              [attr.data-mine]="holder?.id === myParticipantId() ? '' : null"
              [attr.data-available]="!holder && myParticipantId() ? '' : null"
              (click)="onClaimRole(role.id)"
            >
              <div>
                <span class="role-label">{{ role.label }}</span>
                <span class="role-type">
                  {{ role.player_type === 'decision_maker' ? 'Decision Maker' : 'Advisor' }}
                </span>
              </div>
              @if (holder) {
                <ui-badge [variant]="holder.id === myParticipantId() ? 'default' : 'outline'">
                  {{ holder.display_name }}{{ holder.id === myParticipantId() ? ' (You)' : '' }}
                </ui-badge>
              } @else {
                <span class="text-sm text-muted-foreground">Open</span>
              }
            </div>
          }

          @if (data().requires_gm) {
            @let gmHolder = holderOf('game-master');
            <div
              class="role-slot"
              [attr.data-taken]="gmHolder && gmHolder.id !== myParticipantId() ? '' : null"
              [attr.data-mine]="gmHolder?.id === myParticipantId() ? '' : null"
              [attr.data-available]="!gmHolder && myParticipantId() ? '' : null"
              (click)="onClaimRole('game-master')"
            >
              <div>
                <span class="role-label">Game Master (Trainer)</span>
                <span class="role-type">Facilitator</span>
              </div>
              @if (gmHolder) {
                <ui-badge [variant]="gmHolder.id === myParticipantId() ? 'default' : 'outline'">
                  {{ gmHolder.display_name }}{{ gmHolder.id === myParticipantId() ? ' (You)' : '' }}
                </ui-badge>
              } @else {
                <span class="text-sm text-muted-foreground">Open</span>
              }
            </div>
          }
        </div>

        @if (!myParticipantId()) {
          <div class="join-form">
            <ui-input
              id="lobby-name"
              label="Your Name"
              placeholder="Enter your name"
              [(value)]="displayName"
              style="flex: 1;"
            />
            <button
              uiButton variant="default"
              [disabled]="!displayName().trim() || joining()"
              (click)="onJoin()"
            >
              {{ joining() ? 'Joining...' : 'Join' }}
            </button>
          </div>
        } @else {
          <div class="flex gap-sm justify-between">
            <button uiButton variant="outline" (click)="onLeave()">Leave</button>
            <button
              uiButton variant="default"
              [disabled]="!allRolesFilled()"
              (click)="onStart()"
            >
              Start Exercise ({{ participants().length }}/{{ data().max_players }})
            </button>
          </div>
        }
      </div>
    </ui-card>
  `,
})
export class LobbyPreview implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly api = inject(WaitingRoomApiService);
  private readonly ws = inject(ExerciseWsService);
  private readonly engineApi = inject(EngineApiService);
  private sub: Subscription | null = null;

  readonly data = input.required<JoinableExercise>();
  readonly exerciseLeft = output<void>();

  protected readonly participants = signal<ParticipantResponse[]>([]);
  protected readonly myParticipantId = signal('');
  protected readonly displayName = signal('');
  protected readonly joining = signal(false);

  protected readonly allRolesFilled = computed(() => {
    const d = this.data();
    return this.participants().length >= d.max_players;
  });

  ngOnInit(): void {
    this.participants.set(this.data().participants);
    const eId = this.data().exercise.id;

    this.ws.connect(eId, 'player');
    this.sub = this.ws.messages$.subscribe((msg) => {
      if (msg.type === 'waiting_room_update') {
        const updated = msg['participants'] as ParticipantResponse[];
        if (updated) this.participants.set(updated);
      }
    });
  }

  ngOnDestroy(): void {
    this.ws.disconnect();
    this.sub?.unsubscribe();
  }

  protected holderOf(roleId: string): ParticipantResponse | undefined {
    return this.participants().find((p) => p.role === roleId);
  }

  protected onJoin(): void {
    const name = this.displayName().trim();
    if (!name) return;
    this.joining.set(true);

    // Join with default "player" role, user will pick a role slot after
    this.api
      .join(this.data().exercise.id, name, 'player')
      .subscribe({
        next: (p) => {
          this.myParticipantId.set(p.id);
          this.joining.set(false);
        },
        error: () => this.joining.set(false),
      });
  }

  protected onClaimRole(roleId: string): void {
    const pId = this.myParticipantId();
    if (!pId) return;
    const current = this.participants().find((p) => p.id === pId);
    if (current?.role === roleId) return;

    this.api
      .updateRole(this.data().exercise.id, pId, roleId)
      .subscribe();
  }

  protected onLeave(): void {
    const pId = this.myParticipantId();
    if (!pId) return;
    this.api.leave(this.data().exercise.id, pId).subscribe({
      next: () => {
        this.myParticipantId.set('');
        this.exerciseLeft.emit();
      },
      error: () => {
        this.myParticipantId.set('');
        this.exerciseLeft.emit();
      },
    });
  }

  protected onStart(): void {
    const eId = this.data().exercise.id;
    const pId = this.myParticipantId();
    const me = this.participants().find((p) => p.id === pId);
    const isGm = me?.role === 'game-master';

    this.engineApi.start(eId).subscribe({
      next: () => {
        const route = isGm ? '/gm' : '/player';
        this.router.navigate([route], {
          queryParams: { exerciseId: eId, participantId: pId },
        });
      },
    });
  }
}
