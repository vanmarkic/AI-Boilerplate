import type { EngineApiService, PhaseChange } from '../../core/engine-api.service';
import type { ExerciseStore } from '../../core/exercise.store';

type StoreInstance = InstanceType<typeof ExerciseStore>;

/** Apply a phase+time response from an engine action to the store */
function applyPhaseResponse(store: StoreInstance, response: PhaseChange): void {
  store.applyPhaseChange(response.phase);
  store.applyTimeUpdate(response.time as never);
}

export function startExercise(api: EngineApiService, store: StoreInstance, exerciseId: number): void {
  api.start(exerciseId).subscribe({ next: (r: PhaseChange) => applyPhaseResponse(store, r) });
}

export function pauseExercise(api: EngineApiService, store: StoreInstance, exerciseId: number): void {
  api.pause(exerciseId).subscribe({ next: (r: PhaseChange) => applyPhaseResponse(store, r) });
}

export function resetExercise(api: EngineApiService, store: StoreInstance, exerciseId: number): void {
  api.reset(exerciseId).subscribe({ next: (r: PhaseChange) => applyPhaseResponse(store, r) });
}

export function completeExercise(api: EngineApiService, store: StoreInstance, exerciseId: number): void {
  api.complete(exerciseId).subscribe({ next: (r: PhaseChange) => applyPhaseResponse(store, r) });
}

/** GM inject/defect control functions — extracted to reduce view size. */
export function createInjectActions(api: EngineApiService, exerciseId: () => number) {
  return {
    trigger: (id: string) => api.triggerInject(exerciseId(), id).subscribe(),
    cancel: (id: string) => api.cancelInject(exerciseId(), id).subscribe(),
    complete: (id: string) => api.completeInject(exerciseId(), id).subscribe(),
    pause: (id: string) => api.pauseInject(exerciseId(), id).subscribe(),
    resume: (id: string) => api.resumeInject(exerciseId(), id).subscribe(),
    skip: (id: string) => api.skipInject(exerciseId(), id).subscribe(),
    delay: (id: string) => api.delayInject(exerciseId(), id, 30000).subscribe(),
  };
}

export function createDefectActions(api: EngineApiService, exerciseId: () => number) {
  return {
    activate: (id: string) => api.activateDefect(exerciseId(), id).subscribe(),
    mitigate: (id: string) => api.mitigateDefect(exerciseId(), id).subscribe(),
    resolve: (id: string) => api.resolveDefect(exerciseId(), id).subscribe(),
  };
}
