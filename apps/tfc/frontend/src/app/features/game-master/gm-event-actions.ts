import type { EngineApiService } from '../../core/engine-api.service';

/** GM event/issue control functions — extracted to reduce view size. */
export function createEventActions(api: EngineApiService, exerciseId: () => number) {
  return {
    trigger: (id: string) => api.triggerEvent(exerciseId(), id).subscribe(),
    cancel: (id: string) => api.cancelEvent(exerciseId(), id).subscribe(),
    complete: (id: string) => api.completeEvent(exerciseId(), id).subscribe(),
    pause: (id: string) => api.pauseEvent(exerciseId(), id).subscribe(),
    resume: (id: string) => api.resumeEvent(exerciseId(), id).subscribe(),
    skip: (id: string) => api.skipEvent(exerciseId(), id).subscribe(),
    delay: (id: string) => api.delayEvent(exerciseId(), id, 30000).subscribe(),
  };
}

export function createIssueActions(api: EngineApiService, exerciseId: () => number) {
  return {
    activate: (id: string) => api.activateIssue(exerciseId(), id).subscribe(),
    mitigate: (id: string) => api.mitigateIssue(exerciseId(), id).subscribe(),
    resolve: (id: string) => api.resolveIssue(exerciseId(), id).subscribe(),
  };
}
