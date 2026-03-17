import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  CardComponent,
  InputComponent,
  ButtonDirective,
} from '@aspect/ui';
import { WaitingRoomApiService } from '../../core/waiting-room-api.service';
import { environment } from '../../core/environment';

interface ExerciseLookup {
  id: number;
  title: string;
  session_code: string;
  game_mode: string;
}

@Component({
  selector: 'tfc-join-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, CardComponent, InputComponent, ButtonDirective],
  template: `
    <div class="flex justify-center items-center min-h-screen p-lg">
      <ui-card [title]="selectedRole() === 'game-master' ? 'Run Exercise' : 'Join Exercise'">
        <div class="flex flex-col gap-md" style="min-width: 320px;">
          <a routerLink="/home" class="text-sm" style="color: var(--color-muted-foreground); text-decoration: none;">
            ← Back
          </a>
          <ui-input
            id="session-code"
            label="Session Code"
            placeholder="e.g. ABC123"
            [(value)]="sessionCode"
          />

          @if (exerciseTitle()) {
            <p class="text-sm">
              Exercise: <strong>{{ exerciseTitle() }}</strong>
            </p>
          }

          <ui-input
            id="display-name"
            label="Display Name"
            placeholder="Enter your name"
            [(value)]="displayName"
          />

          @if (gameMode() !== 'simple_collaborative') {
            <div class="flex flex-col gap-sm">
              <label class="text-sm font-medium">Role</label>
              <select
                class="input-base"
                [value]="selectedRole()"
                (change)="onRoleChange($event)"
              >
                <option value="player">Player</option>
                <option value="observer">Observer</option>
                <option value="game-master">Game Master</option>
              </select>
            </div>
          }

          @if (error()) {
            <p class="text-sm" style="color: var(--color-destructive)">{{ error() }}</p>
          }

          <button
            uiButton
            variant="default"
            (click)="onJoin()"
            [disabled]="!canJoin() || joining()"
          >
            {{ joining() ? 'Joining...' : 'Join' }}
          </button>
        </div>
      </ui-card>
    </div>
  `,
})
export class JoinView implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly waitingRoomApi = inject(WaitingRoomApiService);

  protected readonly sessionCode = signal('');
  protected readonly displayName = signal('');
  protected readonly selectedRole = signal<string>('player');
  protected readonly joining = signal(false);
  protected readonly error = signal('');
  protected readonly exerciseTitle = signal('');
  protected readonly gameMode = signal('classic');
  private resolvedExerciseId: number | null = null;

  ngOnInit(): void {
    const { role, code } = this.route.snapshot.queryParams;
    const validRoles = ['player', 'observer', 'game-master'];
    if (role && validRoles.includes(role)) {
      this.selectedRole.set(role);
    }
    if (code) {
      this.sessionCode.set((code as string).toUpperCase());
    }
  }

  protected canJoin(): boolean {
    return this.sessionCode().trim().length > 0
      && this.displayName().trim().length > 0;
  }

  protected onRoleChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedRole.set(value);
  }

  protected onJoin(): void {
    const code = this.sessionCode().trim().toUpperCase();
    if (!code) {
      this.error.set('Please enter a session code');
      return;
    }

    this.joining.set(true);
    this.error.set('');

    // Try session code lookup first, fall back to numeric ID
    const isNumeric = /^\d+$/.test(code);
    if (isNumeric) {
      this.joinExercise(Number(code));
    } else {
      this.http
        .get<ExerciseLookup>(
          `${environment.apiBaseUrl}/api/exercises/by-code/${code}`,
        )
        .subscribe({
          next: (exercise) => {
            this.exerciseTitle.set(exercise.title);
            this.gameMode.set(exercise.game_mode);
            if (exercise.game_mode === 'simple_collaborative') {
              this.selectedRole.set('player');
            }
            this.joinExercise(exercise.id);
          },
          error: () => {
            this.joining.set(false);
            this.error.set('Session code not found. Check and try again.');
          },
        });
    }
  }

  private joinExercise(exerciseId: number): void {
    this.resolvedExerciseId = exerciseId;
    this.waitingRoomApi
      .join(exerciseId, this.displayName().trim(), this.selectedRole())
      .subscribe({
        next: (participant) => {
          this.router.navigate(['/waiting-room'], {
            queryParams: {
              exerciseId,
              participantId: participant.id,
              gameMode: this.gameMode(),
            },
          });
        },
        error: () => {
          this.joining.set(false);
          this.error.set('Failed to join. Check the session code and try again.');
        },
      });
  }
}
