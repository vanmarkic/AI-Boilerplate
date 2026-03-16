import type { EngineApiService } from '../../core/engine-api.service';
import type { ExerciseStore } from '../../core/exercise.store';

type StoreInstance = InstanceType<typeof ExerciseStore>;

/** Apply a phase+time response from an engine action to the store */
function applyPhaseResponse(
  store: StoreInstance,
  response: { phase: string; time: Record<string, unknown> },
): void {
  store.applyPhaseChange(response.phase);
  store.applyTimeUpdate(response.time as never);
}

export function startExercise(api: EngineApiService, store: StoreInstance, exerciseId: number): void {
  api.start(exerciseId).subscribe({
    next: (r) => applyPhaseResponse(store, r),
  });
}

export function pauseExercise(api: EngineApiService, store: StoreInstance, exerciseId: number): void {
  api.pause(exerciseId).subscribe({
    next: (r) => applyPhaseResponse(store, r),
  });
}

export function resetExercise(api: EngineApiService, store: StoreInstance, exerciseId: number): void {
  api.reset(exerciseId).subscribe({
    next: (r) => applyPhaseResponse(store, r),
  });
}

export function completeExercise(api: EngineApiService, store: StoreInstance, exerciseId: number): void {
  api.complete(exerciseId).subscribe({
    next: (r) => applyPhaseResponse(store, r),
  });
}
