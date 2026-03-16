import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type { EngineSnapshot, EventSnapshot, IssueSnapshot } from './engine-api.service';
import { formatTimeMs } from './format-time';

interface ExerciseState {
  exerciseId: number | null;
  title: string;
  phase: string;
  playTimeMs: number;
  realTimeMs: number;
  speedFactor: number;
  paused: boolean;
  events: EventSnapshot[];
  issues: IssueSnapshot[];
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
  events: [],
  issues: [],
  loading: false,
  error: null,
};

export const ExerciseStore = signalStore(
  withState(initialState),

  withComputed((store) => ({
    rtClock: computed(() => formatTimeMs(store.realTimeMs())),
    ptClock: computed(() => formatTimeMs(store.playTimeMs())),
    activeEvents: computed(() => store.events().filter((e) => e.lifecycle === 'running')),
    scheduledEvents: computed(() => store.events().filter((e) => e.lifecycle === 'scheduled')),
    completedEvents: computed(() => store.events().filter((e) => e.lifecycle === 'completed')),
    activeIssues: computed(() => store.issues().filter((i) => i.lifecycle === 'active')),
    releasedIssues: computed(() => store.issues().filter((i) => i.released)),
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
  })),
);
