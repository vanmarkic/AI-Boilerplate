import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environment';

export interface DecisionOption {
  id: string;
  label: string;
  score?: number;
}

export interface ActiveDecision {
  id: string;
  event_id: string | null;
  issue_id: string | null;
  title: string;
  description: string;
  question_type: string;
  options: DecisionOption[];
  completion_mode: string;
  target_roles: string[];
  status: string;
  opened_at_pt_ms: number;
  closed_at_pt_ms: number | null;
}

export interface DecisionSubmission {
  participant_id: string;
  participant_name: string;
  selected_options: string[] | null;
  free_text: string | null;
}

export interface DecisionResponseItem {
  id: number;
  participant_name: string;
  selected_options: string[] | null;
  free_text: string | null;
  score: number | null;
  submitted_at: string;
}

export interface DecisionDetail {
  id: number;
  exercise_id: number;
  issue_id: string;
  title: string;
  description: string;
  question_type: string;
  options: DecisionOption[] | null;
  completion_mode: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  responses: DecisionResponseItem[];
}

export interface ScenarioContext {
  title: string;
  description: string;
  briefing: string;
  objectives: string[];
  rules: string[];
}

@Injectable({ providedIn: 'root' })
export class DecisionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** Get open decisions from the engine */
  getEngineDecisions(exerciseId: number): Observable<ActiveDecision[]> {
    return this.http.get<ActiveDecision[]>(
      `${this.base}/api/exercises/${exerciseId}/engine/decisions`,
    );
  }

  /** Submit a response to a DB-persisted decision */
  submitResponse(decisionId: number, submission: DecisionSubmission): Observable<DecisionResponseItem> {
    return this.http.post<DecisionResponseItem>(
      `${this.base}/api/decisions/${decisionId}/responses`,
      submission,
    );
  }

  /** Get decision details with all responses (for GM observation) */
  getDecisionDetail(decisionId: number): Observable<DecisionDetail> {
    return this.http.get<DecisionDetail>(
      `${this.base}/api/decisions/${decisionId}`,
    );
  }

  /** List all decisions for an exercise */
  listDecisions(exerciseId: number, status?: string): Observable<DecisionDetail[]> {
    const params = status ? { status } : {};
    return this.http.get<DecisionDetail[]>(
      `${this.base}/api/decisions`,
      { params: { exercise_id: exerciseId, ...params } },
    );
  }

  /** Close a decision in the engine (GM action) */
  closeEngineDecision(exerciseId: number, decisionId: string): Observable<unknown> {
    return this.http.post(
      `${this.base}/api/exercises/${exerciseId}/engine/decisions/${decisionId}/close`,
      {},
    );
  }

  /** Get scenario context/reference info */
  getContext(exerciseId: number): Observable<ScenarioContext> {
    return this.http.get<ScenarioContext>(
      `${this.base}/api/exercises/${exerciseId}/engine/context`,
    );
  }
}
