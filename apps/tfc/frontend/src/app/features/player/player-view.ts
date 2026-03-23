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
import { ClockDisplayComponent } from "../../shared/clock-display.component";
import { PhaseBadgeComponent } from "../../shared/phase-badge.component";
import { AmbientBackgroundComponent } from "../../shared/ambient-background.component";
import { BriefingOverlayComponent } from "../../shared/briefing-overlay.component";
import { CompletionOverlayComponent } from "../../shared/completion-overlay.component";
import {
  resolvePlayerRole,
  submitRoleRecommendation,
  submitDecision,
} from "./player-decision-handlers";
import { LogsDrawerComponent } from "../../shared/logs-drawer.component";
import { StressBarComponent } from "../../shared/stress-bar.component";
import { StressOverlayComponent } from "../../shared/stress-overlay.component";
import { DomainService } from "../../core/domain.service";
import { EngineApiService } from "../../core/engine-api.service";
import { ExerciseWsService } from "../../core/exercise-ws.service";
import { ExerciseStore } from "../../core/exercise.store";
import { TickService } from "../../core/tick.service";
import { DecisionApiService } from "../../core/decision-api.service";
import { Subscription } from "rxjs";
import { handlePlayerWsMessage } from "./player-ws-handler";
import { RoleCardComponent } from "./role-card.component";
import { SystemStatusBoardComponent } from "../../shared/system-status-board.component";
import { WarfareDomainBoardComponent } from "../../shared/warfare-domain-board.component";
import type { RoleCardSubmission } from "./role-card.component";
import {
  CoDecisionBarComponent,
  type CoDecisionConfirmation,
} from "./co-decision-bar.component";
import { buildRoleCards } from "./role-card.types";

@Component({
  selector: "tfc-player-view",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExerciseStore, TickService],
  imports: [
    ClockDisplayComponent,
    PhaseBadgeComponent,
    AmbientBackgroundComponent,
    BriefingOverlayComponent,
    CompletionOverlayComponent,
    LogsDrawerComponent,
    StressBarComponent,
    StressOverlayComponent,
    ButtonDirective,
    RoleCardComponent,
    CoDecisionBarComponent,
    SystemStatusBoardComponent,
    WarfareDomainBoardComponent,
  ],
  templateUrl: "./player-view.html",
})
export class PlayerView implements OnInit, OnDestroy {
  protected readonly store = inject(ExerciseStore);
  protected readonly domain = inject(DomainService);
  private readonly api = inject(EngineApiService);
  private readonly decisionApi = inject(DecisionApiService);
  protected readonly logsOpen = signal(false);
  private readonly ws = inject(ExerciseWsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly roleLabel = signal("Advisor");
  protected readonly beginningExercise = signal(false);
  private readonly exerciseId = signal(1);
  private readonly participantId = signal("");
  private readonly tick = inject(TickService);
  private snapshotLoaded = false;
  private sub: Subscription | null = null;
  private connSub: Subscription | null = null;

  protected readonly stressEffectPreset = computed(
    () => this.store.context()?.stress_effect_preset ?? "standard",
  );

  protected readonly activeDecisions = computed(() => {
    const role = this.store.playerRole();
    return this.store.openDecisions().filter((d) => {
      if (!d.target_roles || d.target_roles.length === 0) return true;
      if (
        role === "all_roles" ||
        role === "all_advisors" ||
        role === "solo_player" ||
        role === "decision_maker"
      )
        return true;
      return d.target_roles.includes(role);
    });
  });

  protected readonly isMultiRole = computed(() => {
    const role = this.store.playerRole();
    return (
      role === "all_advisors" || role === "solo_player" || role === "all_roles"
    );
  });

  protected readonly submittedRoles = signal<Set<string>>(new Set());

  protected readonly currentTurnEvent = computed(() => {
    const decisions = this.activeDecisions();
    if (decisions.length === 0) return null;
    const decision = decisions[0];
    if (!decision.event_id) return null;
    return this.store.events().find((e) => e.id === decision.event_id) ?? null;
  });

  protected readonly roleCards = computed(() => {
    const allRoles = this.store.context()?.roles ?? [];
    const event = this.currentTurnEvent();
    const decision = this.activeDecisions()[0] ?? null;
    const role = this.store.playerRole();
    const multiRole = this.isMultiRole();
    const playerRoleDef = allRoles.find((r) => r.id === role);
    const showDecisionMaker =
      role === "all_roles" ||
      role === "solo_player" ||
      role === "decision_maker" ||
      this.store.isPracticeMode() ||
      playerRoleDef?.player_type === "decision_maker";
    // Single-role players see only their own role card.
    // "decision_maker" URL param maps to the CO role (player_type === "decision_maker").
    let roles: typeof allRoles;
    if (multiRole) {
      roles = allRoles;
    } else if (role === "decision_maker") {
      roles = allRoles.filter((r) => r.player_type === "decision_maker");
    } else {
      roles = allRoles.filter((r) => r.id === role);
    }
    return buildRoleCards(
      roles,
      event,
      decision,
      this.submittedRoles(),
      showDecisionMaker,
      allRoles,
    );
  });

  private _lastDecisionId: string | null = null;
  private readonly resetSubmittedRolesEffect = effect(() => {
    const id = this.activeDecisions()[0]?.id ?? null;
    // Only reset when the decision ID actually changes (not on every WS push)
    if (id && id !== this._lastDecisionId) {
      this._lastDecisionId = id;
      this.submittedRoles.set(new Set());
    }
  });

  protected readonly advisorRoleCards = computed(() => {
    const allRoles = this.store.context()?.roles ?? [];
    const advisors = allRoles.filter((r) => r.player_type === "advisor");
    const activeCards = this.roleCards().filter(
      (c) => c.playerType === "advisor",
    );
    const activeMap = new Map(activeCards.map((c) => [c.roleId, c]));
    return advisors.map(
      (role) =>
        activeMap.get(role.id) ?? {
          roleId: role.id,
          roleLabel: role.label,
          playerType: "advisor" as const,
          intel: null,
          decision: null,
          status: "intel" as const,
          advisorRecs: [],
        },
    );
  });

  protected readonly isAllRoles = computed(() => {
    const role = this.store.playerRole();
    return role === "all_roles" || role === "solo_player";
  });

  protected readonly isDecisionMaker = computed(() => {
    const role = this.store.playerRole();
    const allRoles = this.store.context()?.roles ?? [];
    const playerRoleDef = allRoles.find((r) => r.id === role);
    return (
      role === "decision_maker" ||
      playerRoleDef?.player_type === "decision_maker"
    );
  });

  protected readonly coRoleDef = computed(() => {
    const allRoles = this.store.context()?.roles ?? [];
    return allRoles.find((r) => r.player_type === "decision_maker") ?? null;
  });

  protected readonly coIntel = computed(() => {
    const event = this.currentTurnEvent();
    const id = this.coRoleDef()?.id;
    if (!event || !id) return null;
    return event.role_descriptions?.[id] ?? null;
  });

  protected readonly advisorRoles = computed(() => {
    const allRoles = this.store.context()?.roles ?? [];
    return allRoles.filter((r) => r.player_type === "advisor");
  });

  protected onCoDecisionConfirmed(confirmation: CoDecisionConfirmation): void {
    const decision = this.activeDecisions()[0];
    if (!decision) return;
    submitDecision(this.decisionApi, this.store, this.exerciseId(), decision, {
      selectedOptions: confirmation.selectedOptionIds,
      freeText: "",
      targetSystemSelections: confirmation.targetSystemSelections,
    });
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
      handlePlayerWsMessage(
        msg,
        this.store,
        () => this.onExerciseStopped(),
        this.ws,
      ),
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
        this.store.applyTimeUpdate(change.time);
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

  protected onExerciseStopped(): void {
    this.ws.disconnect();
    this.router.navigate(["/"]);
  }

  ngOnDestroy(): void {
    this.tick.stop();
    this.ws.disconnect();
    this.sub?.unsubscribe();
    this.connSub?.unsubscribe();
  }
  protected onRoleCardSubmitted(submission: RoleCardSubmission): void {
    const decision = this.activeDecisions()[0];
    if (!decision) return;
    const role = this.store
      .context()
      ?.roles?.find((r) => r.id === submission.roleId);
    if (role?.player_type === "decision_maker") {
      submitDecision(
        this.decisionApi,
        this.store,
        this.exerciseId(),
        decision,
        submission,
      );
    } else {
      submitRoleRecommendation(
        this.decisionApi,
        this.exerciseId(),
        decision,
        this.participantId(),
        {
          roleId: submission.roleId,
          selectedOptions: submission.selectedOptions,
          freeText: submission.freeText,
        },
      );
    }
    const updated = new Set(this.submittedRoles());
    updated.add(submission.roleId);
    this.submittedRoles.set(updated);
  }
}
