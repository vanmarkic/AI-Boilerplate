import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environment';

export interface ScenarioEventDef {
  id: string;
  title: string;
  description: string;
  event_type: string;
  scheduled_pt_ms: number;
  duration_ms: number | null;
  dependencies: string[];
  triggered_issues: string[];
}

export interface ScenarioIssueDef {
  id: string;
  title: string;
  description: string;
  trigger_mode: string;
  trigger_time_pt_ms: number | null;
  trigger_event_id: string | null;
  auto_resolve_ms: number;
}

export interface DecisionOptionDef {
  id: string;
  label: string;
  score: number;
}

export interface DecisionTemplateDef {
  id: string;
  title: string;
  description: string;
  issue_id: string;
  question_type: string;
  options: DecisionOptionDef[];
  completion_mode: string;
  timeout_ms?: number;
  target_roles?: string[];
  forced_option_ids?: string[];
}

export interface RoleDef {
  id: string;
  label: string;
  player_type: string;
}

export interface ScenarioContent {
  phases: { id: string; title: string; description: string; duration_ms: number | null; events: string[] }[];
  events: ScenarioEventDef[];
  issues: ScenarioIssueDef[];
  decision_templates: DecisionTemplateDef[];
  default_time_factor: number;
  game_mode?: string;
  briefing?: string;
  objectives?: string[];
  rules?: string[];
  roles?: RoleDef[];
}

export interface ScenarioResponse {
  id: number;
  title: string;
  description: string;
  domain_id: number | null;
  content: ScenarioContent | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CreateScenarioRequest {
  title: string;
  description?: string;
  domain_id?: number | null;
  content?: ScenarioContent | null;
}

@Injectable({ providedIn: 'root' })
export class ScenarioApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  list(): Observable<ScenarioResponse[]> {
    return this.http.get<ScenarioResponse[]>(`${this.base}/api/scenarios`);
  }

  get(id: number): Observable<ScenarioResponse> {
    return this.http.get<ScenarioResponse>(`${this.base}/api/scenarios/${id}`);
  }

  create(request: CreateScenarioRequest): Observable<ScenarioResponse> {
    return this.http.post<ScenarioResponse>(`${this.base}/api/scenarios`, request);
  }

  update(id: number, request: Partial<CreateScenarioRequest>): Observable<ScenarioResponse> {
    return this.http.put<ScenarioResponse>(`${this.base}/api/scenarios/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/scenarios/${id}`);
  }
}
