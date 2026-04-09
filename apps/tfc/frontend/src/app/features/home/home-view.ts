import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { HttpClient } from "@angular/common/http";
import { Router, RouterLink } from "@angular/router";
import { SeaBackdrop } from "./sea-backdrop";
import { ScenarioPicker } from "./scenario-picker";
import type { JoinableExercise } from "./lobby-preview";
import { ExerciseApiService } from "../../core/exercise-api.service";
import { EngineApiService } from "../../core/engine-api.service";
import { LobbyWsService } from "../../core/lobby-ws.service";
import { WaitingRoomApiService } from "../../core/waiting-room-api.service";
import type { ScenarioResponse } from "../../core/scenario-api.service";
import { environment } from "../../core/environment";
import { switchMap } from "rxjs";

@Component({
  selector: "tfc-home-view",
  host: { class: "home-host" },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SeaBackdrop, ScenarioPicker],
  template: `
    <tfc-sea-backdrop />
    <div class="home-layout">
      <div class="home-hero">
        <h1 class="home-hero__title">TFC</h1>
        <p class="home-hero__subtitle">
          SYS.INIT // Training Flow Control — Exercise Simulation Platform
        </p>
      </div>

      @if (pendingScenario()) {
        <div class="picker-grid">
          <span class="back-link" (click)="pendingScenario.set(null)"
            >Back</span
          >
          <p class="mode-heading">Select Operation Type</p>
          <div class="mode-options">
            <div class="tac-panel" (click)="createMultiplayer('full')">
              <span class="tac-panel__indicator">FTM</span>
              <span class="tac-panel__label">Full Team</span>
              <span class="tac-panel__desc"
                >All roles filled by different players</span
              >
            </div>
            <div class="tac-panel" (click)="createMultiplayer('two_player')">
              <span class="tac-panel__indicator">2PL</span>
              <span class="tac-panel__label">2 Players</span>
              <span class="tac-panel__desc"
                >One decides, one advises all roles</span
              >
            </div>
            <div class="tac-panel" data-primary (click)="createPractice()">
              <span class="tac-panel__indicator">SIM</span>
              <span class="tac-panel__label">Practice (Solo)</span>
              <span class="tac-panel__desc"
                >Play all roles yourself — start immediately</span
              >
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
          <a class="tac-panel" data-primary (click)="showPicker.set(true)">
            <span class="tac-panel__indicator">EXE</span>
            <span class="tac-panel__label">Run Exercise</span>
            <span class="tac-panel__desc"
              >Pick a scenario and start a new exercise</span
            >
          </a>

          <a class="tac-panel" routerLink="/builder">
            <span class="tac-panel__indicator">BLD</span>
            <span class="tac-panel__label">Build Scenario</span>
            <span class="tac-panel__desc"
              >Create and edit exercise scenarios</span
            >
          </a>

          <a class="tac-panel" routerLink="/review">
            <span class="tac-panel__indicator">REV</span>
            <span class="tac-panel__label">Review Results</span>
            <span class="tac-panel__desc"
              >Analyse past exercise outcomes and decisions</span
            >
          </a>

          <a class="tac-panel" routerLink="/foundation">
            <span class="tac-panel__indicator">FND</span>
            <span class="tac-panel__label">Foundation</span>
            <span class="tac-panel__desc"
              >Manage roles, systems, and blue cards</span
            >
          </a>

          @if (lobbyData().length) {
            <a class="tac-panel" data-primary (click)="joinExercise()">
              <span class="tac-panel__indicator">JON</span>
              <span class="tac-panel__label">Join Exercise</span>
              <span class="tac-panel__desc">
                {{ lobbyData().length }} active
                {{ lobbyData().length === 1 ? "operation" : "operations" }}
                awaiting crew
              </span>
              <span class="lobby-live-badge">
                <span class="lobby-live-badge__light"></span>
                Live
              </span>
            </a>
          }
        </nav>

        <div style="margin-top: var(--spacing-lg); text-align: center">
          <a
            routerLink="/foundation"
            class="text-sm text-muted-foreground"
            style="margin-right: var(--spacing-md)"
            >Foundation</a
          >
          <span class="text-sm text-muted-foreground">&middot;</span>
          <a
            routerLink="/gm"
            class="text-sm text-muted-foreground"
            style="margin-left: var(--spacing-md)"
            >Trainer</a
          >
        </div>
      }
    </div>
  `,
})
export class HomeView implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly exerciseApi = inject(ExerciseApiService);
  private readonly engineApi = inject(EngineApiService);
  private readonly lobbyWs = inject(LobbyWsService);
  private readonly waitingRoomApi = inject(WaitingRoomApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly lobbyData = signal<JoinableExercise[]>([]);
  protected readonly showPicker = signal(false);
  protected readonly pendingScenario = signal<ScenarioResponse | null>(null);

  ngOnInit(): void {
    this.checkForJoinableExercises();

    this.lobbyWs.connect();
    this.destroyRef.onDestroy(() => this.lobbyWs.disconnect());
    this.lobbyWs.updates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.checkForJoinableExercises());
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
    this.createAndShowLobby(scenario, false, playerCountMode);
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
          this.waitingRoomApi.join(exercise.id, "Player", "all_roles").pipe(
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
    playerCountMode?: "full" | "two_player",
  ): void {
    const gameMode = scenario.content?.game_mode ?? "classic";
    this.exerciseApi
      .create({
        title: scenario.title,
        scenario_id: scenario.id,
        game_mode: gameMode,
        practice_mode: practiceMode,
        player_count_mode: playerCountMode ?? "full",
      })
      .subscribe({
        next: (exercise) => {
          this.router.navigate(["/waiting-room"], {
            queryParams: {
              exerciseId: exercise.id,
              ...(playerCountMode ? { playerCountMode } : {}),
            },
          });
        },
      });
  }

  protected joinExercise(): void {
    this.router.navigate(["/waiting-room"], {
      queryParams: { browse: true },
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
