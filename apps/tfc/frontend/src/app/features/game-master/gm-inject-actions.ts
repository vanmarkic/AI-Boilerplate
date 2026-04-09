import type { EngineApiService } from '../../core/engine-api.service';

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
