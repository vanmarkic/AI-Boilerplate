import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "./environment";

export type {
  TimeSnapshot,
  EventSnapshot,
  IssueSnapshot,
  EngineSnapshot,
  PhaseChange,
  SpeedChange,
  DecisionSnapshot,
} from "./generated/state-changes.types";

import type {
  EngineSnapshot,
  PhaseChange,
  SpeedChange,
} from "./generated/state-changes.types";

/** Frontend-only type for the score fields within EngineSnapshot.score */
export interface ScoreSnapshot {
  total_score: number;
  penalty_ms: number;
  turn_number: number;
  next_decision_time_ms: number;
}

/** EngineSnapshot with typed score for frontend consumption */
export type SnapshotWithScore = Omit<EngineSnapshot, "score" | "decisions"> & {
  score: ScoreSnapshot | null;
  decisions?: EngineSnapshot["decisions"];
};

@Injectable({ providedIn: "root" })
export class EngineApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  start(exerciseId: number): Observable<PhaseChange> {
    return this.http.post<PhaseChange>(
      `${this.base}/api/exercises/${exerciseId}/engine/start`,
      {},
    );
  }

  begin(exerciseId: number): Observable<PhaseChange> {
    return this.http.post<PhaseChange>(
      `${this.base}/api/exercises/${exerciseId}/engine/begin`,
      {},
    );
  }

  pause(exerciseId: number): Observable<PhaseChange> {
    return this.http.post<PhaseChange>(
      `${this.base}/api/exercises/${exerciseId}/engine/pause`,
      {},
    );
  }

  resume(exerciseId: number): Observable<PhaseChange> {
    return this.http.post<PhaseChange>(
      `${this.base}/api/exercises/${exerciseId}/engine/resume`,
      {},
    );
  }

  reset(exerciseId: number): Observable<PhaseChange> {
    return this.http.post<PhaseChange>(
      `${this.base}/api/exercises/${exerciseId}/engine/reset`,
      {},
    );
  }

  complete(exerciseId: number): Observable<PhaseChange> {
    return this.http.post<PhaseChange>(
      `${this.base}/api/exercises/${exerciseId}/engine/complete`,
      {},
    );
  }

  stop(exerciseId: number): Observable<{ stopped: boolean }> {
    return this.http.post<{ stopped: boolean }>(
      `${this.base}/api/exercises/${exerciseId}/engine/stop`,
      {},
    );
  }

  setSpeed(exerciseId: number, factor: number): Observable<SpeedChange> {
    return this.http.put<SpeedChange>(
      `${this.base}/api/exercises/${exerciseId}/engine/speed`,
      { factor },
    );
  }

  snapshot(exerciseId: number): Observable<SnapshotWithScore> {
    return this.http.get<SnapshotWithScore>(
      `${this.base}/api/exercises/${exerciseId}/engine/snapshot`,
    );
  }

  triggerEvent(
    exerciseId: number,
    eventId: string,
  ): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/events/${eventId}/trigger`,
      {},
    );
  }

  cancelEvent(
    exerciseId: number,
    eventId: string,
  ): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/events/${eventId}/cancel`,
      {},
    );
  }

  completeEvent(
    exerciseId: number,
    eventId: string,
  ): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/events/${eventId}/complete`,
      {},
    );
  }

  pauseEvent(
    exerciseId: number,
    eventId: string,
  ): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/events/${eventId}/pause`,
      {},
    );
  }

  resumeEvent(
    exerciseId: number,
    eventId: string,
  ): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/events/${eventId}/resume`,
      {},
    );
  }

  delayEvent(
    exerciseId: number,
    eventId: string,
    delayMs: number,
  ): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/events/${eventId}/delay`,
      { delay_ms: delayMs },
    );
  }

  skipEvent(
    exerciseId: number,
    eventId: string,
  ): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/events/${eventId}/skip`,
      {},
    );
  }

  activateIssue(
    exerciseId: number,
    issueId: string,
  ): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/issues/${issueId}/activate`,
      {},
    );
  }

  mitigateIssue(
    exerciseId: number,
    issueId: string,
  ): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/issues/${issueId}/mitigate`,
      {},
    );
  }

  resolveIssue(
    exerciseId: number,
    issueId: string,
  ): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/issues/${issueId}/resolve`,
      {},
    );
  }

  releaseIssue(
    exerciseId: number,
    issueId: string,
  ): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/api/exercises/${exerciseId}/engine/issues/${issueId}/release`,
      {},
    );
  }
}
