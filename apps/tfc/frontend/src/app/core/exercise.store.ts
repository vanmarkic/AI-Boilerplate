import { computed } from "@angular/core";
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from "@ngrx/signals";
import type {
  EventSnapshot,
  IssueSnapshot,
  SnapshotWithScore,
  TimeSnapshot,
} from "./engine-api.service";
import type { ActiveDecision, ScenarioContext } from "./decision-api.service";
import type { ScoreChange, SystemSnapshot, SystemStateChange } from "./generated/state-changes.types";
import { formatTimeMs } from "./format-time";

export interface ParticipantPresence {
  id: string;
  display_name: string;
  role: string | null;
  connected: boolean;
}

interface ScoreState {
  turnNumber: number;
  nextDecisionTimeMs: number;
  stress: number;
  scoreTier: string | null;
}

interface ExerciseState {
  exerciseId: number | null;
  title: string;
  phase: string;
  gameMode: string;
  practiceMode: boolean;
  playTimeMs: number;
  realTimeMs: number;
  speedFactor: number;
  paused: boolean;
  events: EventSnapshot[]; // domain: "injects"
  issues: IssueSnapshot[]; // domain: "defects"
  decisions: ActiveDecision[];
  systems: SystemSnapshot[];
  participants: ParticipantPresence[];
  context: ScenarioContext | null;
  participantId: string;
  playerRole: string;
  playerType: string;
  score: ScoreState | null;
  loading: boolean;
  error: string | null;
}

const initialState: ExerciseState = {
  exerciseId: null,
  title: "",
  phase: "setup",
  gameMode: "classic",
  practiceMode: false,
  playTimeMs: 0,
  realTimeMs: 0,
  speedFactor: 1,
  paused: true,
  events: [],
  issues: [],
  decisions: [],
  systems: [],
  participants: [],
  context: null,
  participantId: "",
  playerRole: "player",
  playerType: "advisor",
  score: null,
  loading: false,
  error: null,
};

export const ExerciseStore = signalStore(
  withState(initialState),

  withComputed((store) => ({
    rtClock: computed(() => formatTimeMs(store.realTimeMs())),
    ptClock: computed(() => formatTimeMs(store.playTimeMs())),
    activeEvents: computed(() =>
      store.events().filter((e) => e.lifecycle === "running"),
    ), // active injects
    scheduledEvents: computed(() =>
      store.events().filter((e) => e.lifecycle === "scheduled"),
    ), // scheduled injects
    completedEvents: computed(() =>
      store.events().filter((e) => e.lifecycle === "completed"),
    ), // completed injects
    activeIssues: computed(() =>
      store.issues().filter((i) => i.lifecycle === "active"),
    ), // active defects
    /** Remaining ms on the active decision timer (null if no open decision with timeout). */
    decisionCountdownMs: computed(() => {
      const decision = store
        .decisions()
        .find((d) => d.status === "open" && d.timeout_ms > 0);
      if (!decision) return null;
      const deadline = decision.opened_at_pt_ms + decision.timeout_ms;
      return Math.max(0, deadline - store.playTimeMs());
    }),
    /** Countdown clock: decision timer when a decision is open, otherwise time to next event. */
    turnCountdownClock: computed(() => {
      // Prefer decision countdown when an open decision has a timeout
      const decision = store
        .decisions()
        .find((d) => d.status === "open" && d.timeout_ms > 0);
      if (decision) {
        const deadline = decision.opened_at_pt_ms + decision.timeout_ms;
        return formatTimeMs(Math.max(0, deadline - store.playTimeMs()));
      }
      const pt = store.playTimeMs();
      const nextEvent = store
        .events()
        .filter((e) => e.lifecycle === "scheduled" && e.scheduled_pt_ms > pt)
        .sort((a, b) => a.scheduled_pt_ms - b.scheduled_pt_ms)[0];
      if (!nextEvent) return null;
      const remaining = Math.max(0, nextEvent.scheduled_pt_ms - pt);
      return formatTimeMs(remaining);
    }),
    issuesWithCountdown: computed(() => {
      const pt = store.playTimeMs();
      return store
        .issues()
        .filter(
          (i) =>
            i.lifecycle === "active" &&
            i.auto_resolve_ms > 0 &&
            i.activated_at_pt_ms !== null,
        )
        .map((i) => {
          const elapsed = pt - (i.activated_at_pt_ms ?? 0);
          const remaining = Math.max(0, i.auto_resolve_ms - elapsed);
          return { ...i, remaining_ms: remaining };
        });
    }),
    releasedIssues: computed(() => store.issues().filter((i) => i.released)),
    openDecisions: computed(() =>
      store.decisions().filter((d) => d.status === "open"),
    ),
    hasOpenDecision: computed(
      () => store.decisions().filter((d) => d.status === "open").length > 0,
    ),
    connectedParticipants: computed(() =>
      store.participants().filter((p) => p.connected),
    ),
    connectedCount: computed(
      () => store.participants().filter((p) => p.connected).length,
    ),
    isCollaborative: computed(
      () => store.gameMode() === "simple_collaborative",
    ),
    isDecisionMaker: computed(() => store.playerType() === "decision_maker"),
    isAllAdvisors: computed(() => store.playerRole() === "all_advisors"),
    isPracticeMode: computed(() => store.practiceMode()),
    phaseBadgeVariant: computed<"default" | "secondary" | "destructive">(() => {
      switch (store.phase()) {
        case "running":
          return "default";
        case "paused":
          return "secondary";
        case "completed":
          return "destructive";
        default:
          return "secondary";
      }
    }),
  })),

  withMethods((store) => ({
    setExerciseId(id: number): void {
      patchState(store, { exerciseId: id });
    },

    applySnapshot(snapshot: SnapshotWithScore): void {
      patchState(store, {
        exerciseId: snapshot.exercise_id,
        title: snapshot.title,
        phase: snapshot.phase,
        playTimeMs: snapshot.time.play_time_ms,
        realTimeMs: snapshot.time.real_time_ms,
        speedFactor: snapshot.time.factor,
        paused: snapshot.time.paused,
        events: snapshot.events,
        issues: snapshot.issues,
        systems: snapshot.systems ?? store.systems(),
        decisions: snapshot.decisions ?? store.decisions(),
        score: snapshot.score
          ? {
              stress: snapshot.score.stress,
              turnNumber: snapshot.score.turn_number,
              nextDecisionTimeMs: snapshot.score.next_decision_time_ms,
              scoreTier: snapshot.score.score_tier ?? null,
            }
          : store.score(),
        loading: false,
        error: null,
      });
    },

    applyTimeUpdate(time: TimeSnapshot): void {
      patchState(store, {
        playTimeMs: time.play_time_ms,
        realTimeMs: time.real_time_ms,
        speedFactor: time.factor,
        paused: time.paused,
      });
    },

    /** Advance clocks locally by wall-clock delta (call from a setInterval). */
    tick(wallDeltaMs: number): void {
      if (store.paused()) return;
      const factor = store.speedFactor();
      patchState(store, {
        realTimeMs: store.realTimeMs() + wallDeltaMs,
        playTimeMs: store.playTimeMs() + wallDeltaMs * factor,
      });
    },

    applyPhaseChange(phase: string): void {
      patchState(store, { phase });
    },

    updateEvent(eventId: string, lifecycle: string): void {
      const events = store
        .events()
        .map((e) => (e.id === eventId ? { ...e, lifecycle } : e));
      patchState(store, { events });
    },

    updateIssue(issueId: string, lifecycle: string, released?: boolean): void {
      const issues = store
        .issues()
        .map((i) =>
          i.id === issueId
            ? { ...i, lifecycle, released: released ?? i.released }
            : i,
        );
      patchState(store, { issues });
    },

    setLoading(loading: boolean): void {
      patchState(store, { loading });
    },

    setError(error: string): void {
      patchState(store, { error, loading: false });
    },

    applyDecisions(decisions: ActiveDecision[]): void {
      patchState(store, { decisions });
    },

    setContext(ctx: ScenarioContext): void {
      patchState(store, { context: ctx });
    },

    setParticipantId(id: string): void {
      patchState(store, { participantId: id });
    },

    setPlayerRole(role: string): void {
      patchState(store, { playerRole: role });
    },

    closeDecision(decisionId: string, selectedOptionIds?: string[]): void {
      const decisions = store
        .decisions()
        .map((d) =>
          d.id === decisionId
            ? { ...d, status: "closed", selected_option_ids: selectedOptionIds ?? d.selected_option_ids }
            : d,
        );
      patchState(store, { decisions });
    },

    updatePresence(participants: ParticipantPresence[]): void {
      patchState(store, { participants });
    },

    setGameMode(mode: string): void {
      patchState(store, { gameMode: mode });
    },

    setPracticeMode(practice: boolean): void {
      patchState(store, { practiceMode: practice });
    },

    setPlayerType(playerType: string): void {
      patchState(store, { playerType });
    },

    setSpeedFactor(factor: number): void {
      patchState(store, { speedFactor: factor });
    },

    applyScoreChange(change: Pick<ScoreChange, "total_score" | "stress" | "next_decision_time_ms" | "turn_number">): void {
      patchState(store, {
        score: {
          stress: change.stress,
          nextDecisionTimeMs: change.next_decision_time_ms,
          turnNumber: change.turn_number,
          scoreTier: store.score()?.scoreTier ?? null,
        },
      });
    },

    applyRecommendation(
      decisionId: string,
      participantId: string,
      optionId: string,
    ): void {
      const decisions = store.decisions().map((d) =>
        d.id === decisionId
          ? {
              ...d,
              recommendations: {
                ...d.recommendations,
                [participantId]: optionId,
              },
            }
          : d,
      );
      patchState(store, { decisions });
    },

    applySystemChange(change: Pick<SystemStateChange, "system_id" | "action" | "power" | "operational">): void {
      const systems = store.systems().map((s) =>
        s.system_id === change.system_id
          ? { ...s, power: change.power, operational: change.operational }
          : s,
      );
      patchState(store, { systems });
    },
  })),
);
