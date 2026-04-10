import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environment';

export interface TimeSnapshot {
  play_time_ms: number;
  real_time_ms: number;
  factor: number;
  paused: boolean;
}

export interface InjectSnapshot {
  id: string;
  title: string;
  description: string;
  inject_type: string;
  execution_mode: string;
  scheduled_pt_ms: number;
  duration_ms: number | null;
  dependencies: string[];
  lifecycle: string;
  started_at_pt_ms: number | null;
  completed_at_pt_ms: number | null;
  target_roles: string[];
  role_descriptions: Record<string, string>;
}

export interface DefectSnapshot {
  id: string;
  title: string;
  description: string;
  trigger_mode: string;
  auto_resolve_pt_ms: number;
  auto_resolve_rt_ms: number;
  lifecycle: string;
  activated_at_pt_ms: number | null;
  resolved_at_pt_ms: number | null;
  released: boolean;
}

export interface EngineSnapshot {
  exercise_id: number;
  title: string;
  phase: string;
  time: TimeSnapshot;
  injects: InjectSnapshot[];
  defects: DefectSnapshot[];
}

export interface PhaseChange {
  type: 'phase_change';
  action: string;
  phase: string;
  time: TimeSnapshot;
}

export interface SpeedChange {
  type: 'speed_change';
  factor: number;
}

@Injectable({ providedIn: 'root' })
export class EngineApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  start(exerciseId: number): Observable<PhaseChange> {
    return this.http.post<PhaseChange>(`${this.base}/api/exercises/${exerciseId}/engine/start`, {});
  }

  pause(exerciseId: number): Observable<PhaseChange> {
    return this.http.post<PhaseChange>(`${this.base}/api/exercises/${exerciseId}/engine/pause`, {});
  }

  resume(exerciseId: number): Observable<PhaseChange> {
    return this.http.post<PhaseChange>(
      `${this.base}/api/exercises/${exerciseId}/engine/resume`,
      {},
    );
  }

  reset(exerciseId: number): Observable<PhaseChange> {
    return this.http.post<PhaseChange>(`${this.base}/api/exercises/${exerciseId}/engine/reset`, {});
  }

  complete(exerciseId: number): Observable<PhaseChange> {
    return this.http.post<PhaseChange>(
      `${this.base}/api/exercises/${exerciseId}/engine/complete`,
      {},
    );
  }

  setSpeed(exerciseId: number, factor: number): Observable<SpeedChange> {
    return this.http.put<SpeedChange>(
      `${this.base}/api/exercises/${exerciseId}/engine/speed`,
      { factor },
    );
  }

  snapshot(exerciseId: number): Observable<EngineSnapshot> {
    return this.http.get<EngineSnapshot>(
      `${this.base}/api/exercises/${exerciseId}/engine/snapshot`,
    );
  }

  triggerInject(exerciseId: number, injectId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/injects/${injectId}/trigger`,
      {},
    );
  }

  cancelInject(exerciseId: number, injectId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/injects/${injectId}/cancel`,
      {},
    );
  }

  completeInject(exerciseId: number, injectId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/injects/${injectId}/complete`,
      {},
    );
  }

  pauseInject(exerciseId: number, injectId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/injects/${injectId}/pause`,
      {},
    );
  }

  resumeInject(exerciseId: number, injectId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/injects/${injectId}/resume`,
      {},
    );
  }

  delayInject(exerciseId: number, injectId: string, delayMs: number): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/injects/${injectId}/delay`,
      { delay_ms: delayMs },
    );
  }

  skipInject(exerciseId: number, injectId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/injects/${injectId}/skip`,
      {},
    );
  }

  activateDefect(exerciseId: number, defectId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/defects/${defectId}/activate`,
      {},
    );
  }

  mitigateDefect(exerciseId: number, defectId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/defects/${defectId}/mitigate`,
      {},
    );
  }

  resolveDefect(exerciseId: number, defectId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/defects/${defectId}/resolve`,
      {},
    );
  }

  releaseDefect(exerciseId: number, defectId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/defects/${defectId}/release`,
      {},
    );
  }
}
