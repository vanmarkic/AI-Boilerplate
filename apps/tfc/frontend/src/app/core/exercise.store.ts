import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type { EngineSnapshot, InjectSnapshot, DefectSnapshot } from './engine-api.service';
import type { ActiveDecision, ScenarioContext } from './decision-api.service';
import { formatTimeMs } from './format-time';

export interface ParticipantPresence {
  id: string;
  display_name: string;
  role: string;
  connected: boolean;
}

interface ExerciseState {
  exerciseId: number | null;
  title: string;
  phase: string;
  playTimeMs: number;
  realTimeMs: number;
  speedFactor: number;
  paused: boolean;
  injects: InjectSnapshot[];
  defects: DefectSnapshot[];
  decisions: ActiveDecision[];
  participants: ParticipantPresence[];
  context: ScenarioContext | null;
  playerRole: string;
  loading: boolean;
  error: string | null;
}

const initialState: ExerciseState = {
  exerciseId: null,
  title: '',
  phase: 'setup',
  playTimeMs: 0,
  realTimeMs: 0,
  speedFactor: 1,
  paused: true,
  injects: [],
  defects: [],
  decisions: [],
  participants: [],
  context: null,
  playerRole: 'player',
  loading: false,
  error: null,
};

export const ExerciseStore = signalStore(
  withState(initialState),

  withComputed((store) => ({
    rtClock: computed(() => formatTimeMs(store.realTimeMs())),
    ptClock: computed(() => formatTimeMs(store.playTimeMs())),
    activeInjects: computed(() => store.injects().filter((e: InjectSnapshot) => e.lifecycle === 'running')),
    scheduledInjects: computed(() => store.injects().filter((e: InjectSnapshot) => e.lifecycle === 'scheduled')),
    completedInjects: computed(() => store.injects().filter((e: InjectSnapshot) => e.lifecycle === 'completed')),
    activeDefects: computed(() => store.defects().filter((i: DefectSnapshot) => i.lifecycle === 'active')),
    defectsWithCountdown: computed(() => {
      const pt = store.playTimeMs();
      return store.defects()
        .filter((i: DefectSnapshot) => i.lifecycle === 'active' && i.auto_resolve_pt_ms > 0 && i.activated_at_pt_ms !== null)
        .map((i: DefectSnapshot) => {
          const elapsed = pt - (i.activated_at_pt_ms ?? 0);
          const remaining = Math.max(0, i.auto_resolve_pt_ms - elapsed);
          return { ...i, remaining_ms: remaining };
        });
    }),
    releasedDefects: computed(() => store.defects().filter((i: DefectSnapshot) => i.released)),
    openDecisions: computed(() => store.decisions().filter((d) => d.status === 'open')),
    hasOpenDecision: computed(() => store.decisions().filter((d) => d.status === 'open').length > 0),
    connectedParticipants: computed(() => store.participants().filter((p) => p.connected)),
    connectedCount: computed(() => store.participants().filter((p) => p.connected).length),
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
        injects: snapshot.injects,
        defects: snapshot.defects,
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

    updateInject(injectId: string, lifecycle: string): void {
      const injects = store.injects().map((e: InjectSnapshot) =>
        e.id === injectId ? { ...e, lifecycle } : e,
      );
      patchState(store, { injects });
    },

    updateDefect(defectId: string, lifecycle: string, released?: boolean): void {
      const defects = store.defects().map((i: DefectSnapshot) =>
        i.id === defectId
          ? { ...i, lifecycle, released: released ?? i.released }
          : i,
      );
      patchState(store, { defects });
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
  })),
);
