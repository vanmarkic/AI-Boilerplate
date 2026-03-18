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

/** Inject (event) snapshot from engine. Domain term: "inject". */
export interface EventSnapshot {
  id: string;
  title: string;
  description: string;
  event_type: string;
  scheduled_pt_ms: number;
  duration_ms: number | null;
  dependencies: string[];
  lifecycle: string;
  started_at_pt_ms: number | null;
  completed_at_pt_ms: number | null;
}

/** Defect (issue) snapshot from engine. Domain term: "defect". */
export interface IssueSnapshot {
  id: string;
  title: string;
  description: string;
  trigger_mode: string;
  auto_resolve_ms: number;
  lifecycle: string;
  activated_at_pt_ms: number | null;
  resolved_at_pt_ms: number | null;
  released: boolean;
}

export interface ScoreSnapshot {
  total_score: number;
  penalty_ms: number;
  turn_number: number;
  next_decision_time_ms: number;
}

export interface EngineSnapshot {
  exercise_id: number;
  title: string;
  phase: string;
  time: TimeSnapshot;
  events: EventSnapshot[];
  issues: IssueSnapshot[];
  score: ScoreSnapshot | null;
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

  triggerEvent(exerciseId: number, eventId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/events/${eventId}/trigger`,
      {},
    );
  }

  cancelEvent(exerciseId: number, eventId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/events/${eventId}/cancel`,
      {},
    );
  }

  completeEvent(exerciseId: number, eventId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/events/${eventId}/complete`,
      {},
    );
  }

  pauseEvent(exerciseId: number, eventId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/events/${eventId}/pause`,
      {},
    );
  }

  resumeEvent(exerciseId: number, eventId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/events/${eventId}/resume`,
      {},
    );
  }

  delayEvent(exerciseId: number, eventId: string, delayMs: number): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/events/${eventId}/delay`,
      { delay_ms: delayMs },
    );
  }

  skipEvent(exerciseId: number, eventId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/events/${eventId}/skip`,
      {},
    );
  }

  activateIssue(exerciseId: number, issueId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/issues/${issueId}/activate`,
      {},
    );
  }

  mitigateIssue(exerciseId: number, issueId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/issues/${issueId}/mitigate`,
      {},
    );
  }

  resolveIssue(exerciseId: number, issueId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/issues/${issueId}/resolve`,
      {},
    );
  }

  releaseIssue(exerciseId: number, issueId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/issues/${issueId}/release`,
      {},
    );
  }
}
