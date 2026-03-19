import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router, RouterLink } from "@angular/router";
import { SeaBackdrop } from "./sea-backdrop";
import { ScenarioPicker } from "./scenario-picker";
import { LobbyPreview, type JoinableExercise } from "./lobby-preview";
import { ExerciseApiService } from "../../core/exercise-api.service";
import { EngineApiService } from "../../core/engine-api.service";
import { WaitingRoomApiService } from "../../core/waiting-room-api.service";
import type { ScenarioResponse } from "../../core/scenario-api.service";
import { environment } from "../../core/environment";
import { switchMap } from "rxjs";

@Component({
  selector: "tfc-home-view",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SeaBackdrop, ScenarioPicker, LobbyPreview],
  styles: [
    `
      :host {
        display: block;
        position: relative;
        min-height: 100dvh;
        isolation: isolate;
      }

      .home-layout {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100dvh;
        padding: var(--spacing-xl);
        gap: var(--spacing-xl);
      }

      .home-hero {
        text-align: center;
      }

      .home-hero h1 {
        font-size: var(--font-size-3xl, 2rem);
        font-weight: 700;
        letter-spacing: -0.02em;
        margin: 0 0 var(--spacing-xs);
      }

      .home-hero p {
        color: var(--color-muted-foreground);
        margin: 0;
      }

      .home-menu {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--spacing-md);
        width: 100%;
        max-width: 560px;
      }

      .menu-card {
        --glass-strength: 2.5;
        --glow-strength: 1.5;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
        padding: var(--spacing-xl);
        background: var(--glass-bg);
        backdrop-filter: blur(var(--glass-blur));
        -webkit-backdrop-filter: blur(var(--glass-blur));
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg, 0.75rem);
        box-shadow: var(--glass-shadow);
        text-decoration: none;
        color: inherit;
        transition:
          border-color 0.15s,
          background 0.15s,
          box-shadow 0.15s;
        cursor: pointer;
      }

      .menu-card:hover {
        border-color: var(--color-primary);
        background: color-mix(
          in oklch,
          var(--glass-bg) 80%,
          var(--color-primary) 20%
        );
        box-shadow: var(--glass-shadow), var(--glow-sm);
      }

      .menu-card[data-primary] {
        border-color: var(--color-primary);
        background: color-mix(
          in oklch,
          var(--glass-bg) 85%,
          var(--color-primary) 15%
        );
        box-shadow: var(--glass-shadow), var(--glow-sm);
      }

      .menu-card[data-primary]:hover {
        background: color-mix(
          in oklch,
          var(--glass-bg) 75%,
          var(--color-primary) 25%
        );
        box-shadow: var(--glass-shadow), var(--glow-primary);
      }

      .card-icon {
        font-size: 1.5rem;
        line-height: 1;
      }

      .card-label {
        font-size: var(--font-size-sm, 0.875rem);
        font-weight: 600;
      }

      .card-desc {
        font-size: var(--font-size-xs, 0.75rem);
        color: var(--color-muted-foreground);
        line-height: 1.4;
      }

      .picker-grid {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-md);
        max-width: 560px;
        width: 100%;
      }

      .back-link {
        font-size: var(--font-size-sm, 0.875rem);
        color: var(--color-muted-foreground);
        cursor: pointer;
      }

      .mode-heading {
        font-size: var(--font-size-md, 1rem);
        font-weight: 600;
        margin: 0;
      }

      .mode-options {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--spacing-md);
      }
    `,
  ],
  template: `
    <tfc-sea-backdrop />
    <div class="home-layout">
      <div class="home-hero">
        <h1>Training Flow Control</h1>
        <p>Collaborative exercise simulation platform</p>
      </div>

      @for (lobby of lobbyData(); track lobby.exercise.id) {
        <tfc-lobby-preview [data]="lobby" />
      }

      @if (pendingScenario()) {
        <div class="picker-grid">
          <span class="back-link" (click)="pendingScenario.set(null)">&larr; Back</span>
          <p class="mode-heading">How do you want to play?</p>
          <div class="mode-options">
            <div class="menu-card" (click)="createMultiplayer('full')">
              <span class="card-icon">👥</span>
              <span class="card-label">Full Team</span>
              <span class="card-desc">All roles filled by different players</span>
            </div>
            <div class="menu-card" (click)="createMultiplayer('two_player')">
              <span class="card-icon">👤👤</span>
              <span class="card-label">2 Players</span>
              <span class="card-desc">One decides, one advises all roles</span>
            </div>
            <div class="menu-card" data-primary (click)="createPractice()">
              <span class="card-icon">🎯</span>
              <span class="card-label">Practice (Solo)</span>
              <span class="card-desc">Play all roles yourself — start immediately</span>
            </div>
          </div>
        </div>
      } @else if (showPicker()) {
        <tfc-scenario-picker
          (picked)="onScenarioPicked($event)"
          (dismissed)="showPicker.set(false)"
        />
      } @else {
        <nav class="home-menu" aria-label="Main menu">
          <a class="menu-card" data-primary (click)="showPicker.set(true)">
            <span class="card-icon">🎯</span>
            <span class="card-label">Run Exercise</span>
            <span class="card-desc"
              >Pick a scenario and start a new exercise</span
            >
          </a>

          <a class="menu-card" routerLink="/builder">
            <span class="card-icon">🛠️</span>
            <span class="card-label">Build Scenario</span>
            <span class="card-desc">Create and edit exercise scenarios</span>
          </a>

          <a class="menu-card" routerLink="/review">
            <span class="card-icon">📊</span>
            <span class="card-label">Review Results</span>
            <span class="card-desc"
              >Analyse past exercise outcomes and decisions</span
            >
          </a>
        </nav>
      }
    </div>
  `,
})
export class HomeView implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly exerciseApi = inject(ExerciseApiService);
  private readonly engineApi = inject(EngineApiService);
  private readonly waitingRoomApi = inject(WaitingRoomApiService);

  protected readonly lobbyData = signal<JoinableExercise[]>([]);
  protected readonly showPicker = signal(false);
  protected readonly pendingScenario = signal<ScenarioResponse | null>(null);

  ngOnInit(): void {
    this.checkForJoinableExercises();
  }

  protected onScenarioPicked(scenario: ScenarioResponse): void {
    const gameMode = scenario.content?.game_mode ?? "classic";
    if (gameMode === "simple_collaborative") {
      this.showPicker.set(false);
      this.pendingScenario.set(scenario);
      return;
    }
    this.createAndShowLobby(scenario, false);
  }

  protected createMultiplayer(playerCountMode: "full" | "two_player"): void {
    const scenario = this.pendingScenario();
    if (!scenario) return;
    this.pendingScenario.set(null);
    this.createAndShowLobby(scenario, false);
  }

  protected createPractice(): void {
    const scenario = this.pendingScenario();
    if (!scenario) return;
    this.pendingScenario.set(null);
    const gameMode = scenario.content?.game_mode ?? "simple_collaborative";

    this.exerciseApi
      .create({
        title: scenario.title,
        scenario_id: scenario.id,
        game_mode: gameMode,
        practice_mode: true,
      })
      .pipe(
        switchMap((exercise) =>
          this.waitingRoomApi
            .join(exercise.id, "Player", "all_roles")
            .pipe(
              switchMap((participant) =>
                this.engineApi.start(exercise.id).pipe(
                  switchMap(() => {
                    this.router.navigate(["/player"], {
                      queryParams: {
                        exerciseId: exercise.id,
                        participantId: participant.id,
                        role: "all_roles",
                        gameMode: "simple_collaborative",
                        practiceMode: true,
                      },
                    });
                    return [];
                  }),
                ),
              ),
            ),
        ),
      )
      .subscribe();
  }

  private createAndShowLobby(
    scenario: ScenarioResponse,
    practiceMode: boolean,
  ): void {
    const gameMode = scenario.content?.game_mode ?? "classic";
    this.exerciseApi
      .create({
        title: scenario.title,
        scenario_id: scenario.id,
        game_mode: gameMode,
        practice_mode: practiceMode,
      })
      .subscribe({
        next: (exercise) => {
          this.router.navigate(["/waiting-room"], {
            queryParams: { exerciseId: exercise.id },
          });
        },
      });
  }

  private checkForJoinableExercises(): void {
    this.http
      .get<
        JoinableExercise[]
      >(`${environment.apiBaseUrl}/api/exercises/joinable`)
      .subscribe({
        next: (data) => this.lobbyData.set(data),
        error: () => this.lobbyData.set([]),
      });
  }
}
