import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
} from "@angular/core";
import { ButtonDirective } from "@aspect/ui";
import { ActivatedRoute } from "@angular/router";
import { CardComponent, BadgeComponent } from "@aspect/ui";
import { ClockDisplayComponent } from "../../shared/clock-display.component";
import { PhaseBadgeComponent } from "../../shared/phase-badge.component";
import { DecisionPanelComponent } from "../../shared/decision-panel.component";
import { ContextPanelComponent } from "../../shared/context-panel.component";
import { AmbientBackgroundComponent } from "../../shared/ambient-background.component";
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
  providers: [ExerciseStore],
  imports: [
    CardComponent,
    BadgeComponent,
    ClockDisplayComponent,
    PhaseBadgeComponent,
    DecisionPanelComponent,
    ContextPanelComponent,
    AmbientBackgroundComponent,
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
  private readonly route = inject(ActivatedRoute);
  protected readonly selectedIssueId = signal<string | null>(null);
  protected readonly decisionHistory = signal<DecisionDetail[]>([]);
  protected readonly roleLabel = signal("Advisor");
  protected readonly practicePhase = signal<"advising" | "deciding">("advising");
  private readonly exerciseId = signal(1);
  private readonly participantId = signal("");
  private lastDecisionId = "";
  private sub: Subscription | null = null;
  private connSub: Subscription | null = null;

  protected visibleEvents() {
    return this.store
      .events()
      .filter((e) => e.lifecycle === "running" || e.lifecycle === "completed");
  }

  protected activeDecision(): ActiveDecision | undefined {
    const role = this.store.playerRole();
    return this.store.openDecisions().find((d) => {
      if (!d.target_roles || d.target_roles.length === 0) return true;
      if (role === "all_advisors") return true;
      return d.target_roles.includes(role);
    });
  }

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
    this.ws.connect(id, "player", pId || undefined);
    this.sub = this.ws.messages$.subscribe((msg) =>
      handlePlayerWsMessage(msg, this.store),
    );
    this.loadSnapshot(id);
    this.decisionApi.getContext(id).subscribe({
      next: (ctx) =>
        resolvePlayerRole(ctx, role, gameMode, this.store, this.roleLabel),
    });
    this.decisionApi.getEngineDecisions(id).subscribe({
      next: (decisions) => this.store.applyDecisions(decisions),
    });
    this.decisionApi.listDecisions(id, "closed").subscribe({
      next: (decisions) => this.decisionHistory.set(decisions),
    });
    this.connSub = this.ws.connected$.subscribe((connected) => {
      if (connected) this.loadSnapshot(id);
    });
  }

  private loadSnapshot(exerciseId: number): void {
    this.api.snapshot(exerciseId).subscribe({
      next: (snap) => this.store.applySnapshot(snap),
      error: () => this.store.setError("Failed to load snapshot"),
    });
  }

  ngOnDestroy(): void {
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
