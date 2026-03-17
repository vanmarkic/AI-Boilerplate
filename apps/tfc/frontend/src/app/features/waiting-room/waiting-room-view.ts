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
import {
  WaitingRoomApiService,
  type ParticipantResponse,
} from '../../core/waiting-room-api.service';
import { Subscription } from 'rxjs';

const DEFAULT_ROLES = [
  { id: 'player', label: 'Player' },
  { id: 'observer', label: 'Observer' },
  { id: 'game-master', label: 'Game Master' },
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
            Participants waiting to start exercise #{{ exerciseId() }}.
            Assign roles before starting.
          </p>

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
                  @for (role of availableRoles; track role.id) {
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

          <div class="flex gap-sm justify-end">
            <button
              uiButton
              variant="outline"
              (click)="onLeave()"
            >
              Leave
            </button>
            @if (isGameMaster()) {
              <button
                uiButton
                variant="default"
                (click)="onStartExercise()"
              >
                Start Exercise
              </button>
            }
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
  private sub: Subscription | null = null;

  protected readonly exerciseId = signal(0);
  protected readonly participantId = signal('');
  protected readonly participants = signal<ParticipantResponse[]>([]);
  protected readonly availableRoles = DEFAULT_ROLES;

  protected readonly isGameMaster = computed(() => {
    const me = this.participants().find(
      (p) => p.id === this.participantId(),
    );
    return me?.role === 'game-master';
  });

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const eId = Number(params['exerciseId'] ?? 0);
    const pId = String(params['participantId'] ?? '');
    this.exerciseId.set(eId);
    this.participantId.set(pId);

    this.ws.connect(eId, 'player');
    this.sub = this.ws.messages$.subscribe((msg) => {
      if (msg.type === 'waiting_room_update') {
        const updated = msg['participants'] as ParticipantResponse[];
        if (updated) {
          this.participants.set(updated);
        }
      }
    });

    this.api.listParticipants(eId).subscribe({
      next: (res) => this.participants.set(res.participants),
    });
  }

  ngOnDestroy(): void {
    this.ws.disconnect();
    this.sub?.unsubscribe();
  }

  protected onRoleChange(targetId: string, event: Event): void {
    const role = (event.target as HTMLSelectElement).value;
    this.api
      .updateRole(this.exerciseId(), targetId, role)
      .subscribe();
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
    this.router.navigate(['/gm'], {
      queryParams: { exerciseId: this.exerciseId() },
    });
  }
}
