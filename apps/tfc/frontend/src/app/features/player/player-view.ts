import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { ButtonDirective } from "@aspect/ui";
import { ActivatedRoute, Router } from "@angular/router";
import { CardComponent, BadgeComponent } from "@aspect/ui";
import { ClockDisplayComponent } from "../../shared/clock-display.component";
import { PhaseBadgeComponent } from "../../shared/phase-badge.component";
import { DecisionPanelComponent } from "../../shared/decision-panel.component";
import { ContextPanelComponent } from "../../shared/context-panel.component";
import { AmbientBackgroundComponent } from "../../shared/ambient-background.component";
import { BriefingOverlayComponent } from "../../shared/briefing-overlay.component";
import { TurnBannerComponent } from "../../shared/turn-banner.component";
import { AdvisorBubblesComponent } from "../../shared/advisor-bubbles.component";
import { AllAdvisorsPanelComponent } from "../../shared/all-advisors-panel.component";
import type { RoleRecommendation } from "../../shared/all-advisors-panel.component";
import {
  buildAdvisorRecs,
  getScenarioAdvisorRoles,
  resolvePlayerRole,
  submitRecommendation,
  submitRoleRecommendation,
  submitDecision,
} from "./player-decision-handlers";
import { ScoreBarComponent } from "../../shared/score-bar.component";
import { DomainService } from "../../core/domain.service";
import { EngineApiService } from "../../core/engine-api.service";
import { ExerciseWsService } from "../../core/exercise-ws.service";
import { ExerciseStore } from "../../core/exercise.store";
import { TickService } from "../../core/tick.service";
import { formatTimeMs } from "../../core/format-time";
import { DecisionApiService } from "../../core/decision-api.service";
import type {
  ActiveDecision,
  DecisionDetail,
} from "../../core/decision-api.service";
import { Subscription } from "rxjs";
import { handlePlayerWsMessage } from "./player-ws-handler";

@Component({
  selector: "tfc-player-view",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExerciseStore, TickService],
  imports: [
    CardComponent,
    BadgeComponent,
    ClockDisplayComponent,
    PhaseBadgeComponent,
    DecisionPanelComponent,
    ContextPanelComponent,
    AmbientBackgroundComponent,
    BriefingOverlayComponent,
    TurnBannerComponent,
    AdvisorBubblesComponent,
    AllAdvisorsPanelComponent,
    ScoreBarComponent,
    ButtonDirective,
  ],
  templateUrl: "./player-view.html",
})
export class PlayerView implements OnInit, OnDestroy {
  protected readonly store = inject(ExerciseStore);
  protected readonly domain = inject(DomainService);
  private readonly api = inject(EngineApiService);
  private readonly decisionApi = inject(DecisionApiService);
  private readonly ws = inject(ExerciseWsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly selectedIssueId = signal<string | null>(null);
  protected readonly decisionHistory = signal<DecisionDetail[]>([]);
  protected readonly roleLabel = signal("Advisor");
  protected readonly practicePhase = signal<"advising" | "deciding">("advising");
  protected readonly beginningExercise = signal(false);
  private readonly exerciseId = signal(1);
  private readonly participantId = signal("");
  private readonly tick = inject(TickService);
  private snapshotLoaded = false;
  private sub: Subscription | null = null;
  private connSub: Subscription | null = null;

  protected readonly activeDecision = computed(() => {
    const role = this.store.playerRole();
    return this.store.openDecisions().find((d) => {
      if (!d.target_roles || d.target_roles.length === 0) return true;
      if (role === "all_advisors" || role === "solo_player") return true;
      return d.target_roles.includes(role);
    });
  });

  private readonly resetPracticePhaseEffect = effect(() => {
    const decision = this.activeDecision();
    const id = decision?.id ?? null;
    // When the active decision changes in practice mode, reset to advising phase
    if (id && this.store.isPracticeMode()) {
      this.practicePhase.set("advising");
    }
  });

  protected readonly visibleEvents = computed(() => {
    const role = this.store.playerRole();
    return this.store
      .events()
      .filter((e) => {
        if (e.lifecycle !== "running" && e.lifecycle !== "completed") return false;
        const targetRoles = e.target_roles ?? [];
        if (targetRoles.length === 0) return true;
        if (role === "all_advisors" || role === "solo_player") return true;
        return targetRoles.includes(role);
      })
      .map((e) => ({
        ...e,
        resolvedDescription: (e.role_descriptions ?? {})[role] ?? e.description,
      }));
  });

  protected advisorRecs(decision: ActiveDecision) {
    return buildAdvisorRecs(decision, this.store.context()?.roles ?? []);
  }

  protected scenarioAdvisorRoles() {
    return getScenarioAdvisorRoles(this.store.context()?.roles ?? []);
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const id = Number(params["exerciseId"] ?? 1);
    const pId = String(params["participantId"] ?? "");
    const role = String(params["role"] ?? "player");
    const gameMode = String(params["gameMode"] ?? "");
    this.exerciseId.set(id);
    this.participantId.set(pId);
    this.store.setParticipantId(pId);
    this.store.setPlayerRole(role);
    if (gameMode) {
      this.store.setGameMode(gameMode);
    }
    const practiceMode = params["practiceMode"] === "true";
    this.store.setPracticeMode(practiceMode);
    this.ws.connect(id, "player", pId || undefined);
    this.sub = this.ws.messages$.subscribe((msg) =>
      handlePlayerWsMessage(msg, this.store, () => this.onExerciseStopped()),
    );
    this.loadSnapshot(id);
    this.decisionApi.getContext(id).subscribe({
      next: (ctx) =>
        resolvePlayerRole(ctx, role, gameMode, this.store, this.roleLabel),
      error: () => {},
    });
    this.decisionApi.getEngineDecisions(id).subscribe({
      next: (decisions) => this.store.applyDecisions(decisions),
      error: () => {},
    });
    this.decisionApi.listDecisions(id, "closed").subscribe({
      next: (decisions) => this.decisionHistory.set(decisions),
      error: () => {},
    });
    this.connSub = this.ws.connected$.subscribe((connected) => {
      if (connected && this.snapshotLoaded) this.loadSnapshot(id);
    });
    this.tick.start(this.store);
  }

  private loadSnapshot(exerciseId: number): void {
    this.api.snapshot(exerciseId).subscribe({
      next: (snap) => {
        this.snapshotLoaded = true;
        this.store.applySnapshot(snap);
      },
      error: () => this.store.setError("Failed to load snapshot"),
    });
  }

  protected onBeginExercise(): void {
    this.beginningExercise.set(true);
    this.api.begin(this.exerciseId()).subscribe({
      next: (change) => {
        this.store.applyPhaseChange(change.phase);
        this.beginningExercise.set(false);
      },
      error: () => {
        this.store.setError("Failed to begin exercise");
        this.beginningExercise.set(false);
      },
    });
  }

  protected onStop(): void {
    this.api.stop(this.exerciseId()).subscribe({
      next: () => this.onExerciseStopped(),
    });
  }

  private onExerciseStopped(): void {
    this.ws.disconnect();
    this.router.navigate(["/"]);
  }

  ngOnDestroy(): void {
    this.tick.stop();
    this.ws.disconnect();
    this.sub?.unsubscribe();
    this.connSub?.unsubscribe();
  }
  protected getIssueCountdown(issueId: string): string | null {
    const item = this.store.issuesWithCountdown().find((i) => i.id === issueId);
    if (!item || item.remaining_ms <= 0) return null;
    return formatTimeMs(item.remaining_ms);
  }

  protected selectIssue(issueId: string): void {
    this.selectedIssueId.set(issueId);
  }
  protected eventTypeInitial(type: string): string {
    return type ? type[0].toUpperCase() : '?';
  }
  protected onRecommendationSubmitted(
    decision: ActiveDecision,
    event: { selectedOptions: string[]; freeText: string },
  ): void {
    submitRecommendation(
      this.decisionApi,
      this.exerciseId(),
      decision,
      this.participantId(),
      event,
    );
  }
  protected onRoleRecommendationSubmitted(
    decision: ActiveDecision,
    rec: RoleRecommendation,
  ): void {
    submitRoleRecommendation(
      this.decisionApi,
      this.exerciseId(),
      decision,
      this.participantId(),
      rec,
    );
  }

  protected onPracticeAdviceDone(): void {
    this.practicePhase.set("deciding");
  }

  protected onDecisionSubmitted(
    decision: ActiveDecision,
    event: { selectedOptions: string[]; freeText: string },
  ): void {
    submitDecision(
      this.decisionApi,
      this.store,
      this.exerciseId(),
      decision,
      this.participantId(),
      event,
    );
  }
}
