import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type { EngineSnapshot, EventSnapshot, IssueSnapshot } from './engine-api.service';
import type { ActiveDecision, ScenarioContext } from './decision-api.service';
import { formatTimeMs } from './format-time';

export interface ParticipantPresence {
  id: string;
  display_name: string;
  role: string;
  connected: boolean;
}

interface ScoreState {
  totalScore: number;
  turnNumber: number;
  nextDecisionTimeMs: number;
  penaltyMs: number;
}

interface ExerciseState {
  exerciseId: number | null;
  title: string;
  phase: string;
  gameMode: string;
  playTimeMs: number;
  realTimeMs: number;
  speedFactor: number;
  paused: boolean;
  events: EventSnapshot[];   // domain: "injects"
  issues: IssueSnapshot[];   // domain: "defects"
  decisions: ActiveDecision[];
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
  title: '',
  phase: 'setup',
  gameMode: 'classic',
  playTimeMs: 0,
  realTimeMs: 0,
  speedFactor: 1,
  paused: true,
  events: [],
  issues: [],
  decisions: [],
  participants: [],
  context: null,
  participantId: '',
  playerRole: 'player',
  playerType: 'advisor',
  score: null,
  loading: false,
  error: null,
};

export const ExerciseStore = signalStore(
  withState(initialState),

  withComputed((store) => ({
    rtClock: computed(() => formatTimeMs(store.realTimeMs())),
    ptClock: computed(() => formatTimeMs(store.playTimeMs())),
    activeEvents: computed(() => store.events().filter((e) => e.lifecycle === 'running')),    // active injects
    scheduledEvents: computed(() => store.events().filter((e) => e.lifecycle === 'scheduled')), // scheduled injects
    completedEvents: computed(() => store.events().filter((e) => e.lifecycle === 'completed')), // completed injects
    activeIssues: computed(() => store.issues().filter((i) => i.lifecycle === 'active')),    // active defects
    issuesWithCountdown: computed(() => {
      const pt = store.playTimeMs();
      return store.issues()
        .filter((i) => i.lifecycle === 'active' && i.auto_resolve_ms > 0 && i.activated_at_pt_ms !== null)
        .map((i) => {
          const elapsed = pt - (i.activated_at_pt_ms ?? 0);
          const remaining = Math.max(0, i.auto_resolve_ms - elapsed);
          return { ...i, remaining_ms: remaining };
        });
    }),
    releasedIssues: computed(() => store.issues().filter((i) => i.released)),
    openDecisions: computed(() => store.decisions().filter((d) => d.status === 'open')),
    hasOpenDecision: computed(() => store.decisions().filter((d) => d.status === 'open').length > 0),
    connectedParticipants: computed(() => store.participants().filter((p) => p.connected)),
    connectedCount: computed(() => store.participants().filter((p) => p.connected).length),
    isCollaborative: computed(() => store.gameMode() === 'simple-collaborative'),
    isDecisionMaker: computed(() => store.playerType() === 'decision_maker'),
    phaseBadgeVariant: computed<'default' | 'secondary' | 'destructive'>(() => {
      switch (store.phase()) {
        case 'running': return 'default';
        case 'paused': return 'secondary';
        case 'completed': return 'destructive';
        default: return 'secondary';
      }
    }),
  })),

  withMethods((store) => ({
    setExerciseId(id: number): void {
      patchState(store, { exerciseId: id });
    },

    applySnapshot(snapshot: EngineSnapshot): void {
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
        loading: false,
        error: null,
      });
    },

    applyTimeUpdate(time: { play_time_ms: number; real_time_ms: number; factor: number; paused: boolean }): void {
      patchState(store, {
        playTimeMs: time.play_time_ms,
        realTimeMs: time.real_time_ms,
        speedFactor: time.factor,
        paused: time.paused,
      });
    },

    applyPhaseChange(phase: string): void {
      patchState(store, { phase });
    },

    updateEvent(eventId: string, lifecycle: string): void {
      const events = store.events().map((e) =>
        e.id === eventId ? { ...e, lifecycle } : e,
      );
      patchState(store, { events });
    },

    updateIssue(issueId: string, lifecycle: string, released?: boolean): void {
      const issues = store.issues().map((i) =>
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

    closeDecision(decisionId: string): void {
      const decisions = store.decisions().map((d) =>
        d.id === decisionId ? { ...d, status: 'closed' } : d,
      );
      patchState(store, { decisions });
    },

    updatePresence(participants: ParticipantPresence[]): void {
      patchState(store, { participants });
    },

    setGameMode(mode: string): void {
      patchState(store, { gameMode: mode });
    },

    setPlayerType(playerType: string): void {
      patchState(store, { playerType });
    },

    applyScoreChange(change: { total_score: number; penalty_ms: number; next_decision_time_ms: number; turn_number: number }): void {
      patchState(store, {
        score: {
          totalScore: change.total_score,
          penaltyMs: change.penalty_ms,
          nextDecisionTimeMs: change.next_decision_time_ms,
          turnNumber: change.turn_number,
        },
      });
    },

    applyRecommendation(decisionId: string, participantId: string, optionId: string): void {
      const decisions = store.decisions().map((d) =>
        d.id === decisionId
          ? { ...d, recommendations: { ...d.recommendations, [participantId]: optionId } }
          : d,
      );
      patchState(store, { decisions });
    },
  })),
);
