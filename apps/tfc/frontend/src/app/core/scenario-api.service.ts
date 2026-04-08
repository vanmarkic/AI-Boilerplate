import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "./environment";
import type { DecisionOption } from "./decision-api.service";

export interface ScenarioEventDef {
  id: string;
  title: string;
  description: string;
  event_type: string;
  scheduled_pt_ms: number;
  duration_ms: number | null;
  dependencies: string[];
  triggered_issues: string[];
  target_roles: string[];
  role_descriptions: Record<string, string>;
  execution_mode?: string;
}

export interface ScenarioIssueDef {
  id: string;
  title: string;
  description: string;
  trigger_mode: string;
  trigger_time_pt_ms: number | null;
  trigger_event_id: string | null;
  auto_resolve_pt_ms: number;
  auto_resolve_rt_ms: number;
}

export interface DecisionTemplateDef {
  id: string;
  title: string;
  description: string;
  issue_id: string;
  question_type: string;
  options: DecisionOption[];
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

export interface SystemEffectDef {
  system_id: string;
  operational_state: string | null;
  power_state: boolean | null;
}

export interface SystemStateDef {
  system_id: string;
  operational_state: string | null;
  power_state: boolean | null;
}

export interface DecisionOptionDef {
  id: string;
  label: string;
  score: number;
  system_effects: SystemEffectDef[];
  targets_system: boolean;
  max_plays: number;
}

export interface TurnInjectDef {
  target_roles: string[];
  text: string;
  role_descriptions: Record<string, string>;
}

export interface TurnCardConfig {
  card_id: string;
  score: number;
  stress_delta: number;
  system_effects: SystemEffectDef[];
  domain_effects: DomainEffectDef[];
  max_plays: number;
}

export interface PathNoteDef {
  card_ids: string[];
  notes: string;
}

export interface DomainEffectDef {
  domain_id: string;
  threat_level: string;
}

export interface ScenarioWarfareDomainDef {
  domain_id: string;
  label: string;
  initial_threat_level: string;
}

export interface TurnDefinition {
  turn_index: number;
  title: string;
  facilitator_prompt: string | null;
  has_decisions: boolean;
  duration_ms: number | null;
  inject_ids: string[];
  decision_template_id: string | null;
  injects: TurnInjectDef[];
  available_cards: TurnCardConfig[];
  max_selections: number;
  base_stress_delta: number;
  system_effects_on_start: SystemEffectDef[];
  domain_effects_on_start: DomainEffectDef[];
  best_path: PathNoteDef | null;
  acceptable_path: PathNoteDef | null;
  design_notes: string;
}

export interface ScenarioContent {
  phases: {
    id: string;
    title: string;
    description: string;
    duration_ms: number | null;
    events: string[];
  }[];
  events: ScenarioEventDef[];
  issues: ScenarioIssueDef[];
  decision_templates: DecisionTemplateDef[];
  default_time_factor: number;
  default_event_duration_ms?: number | null;
  game_mode?: string;
  game_mode_config?: Record<string, unknown>;
  briefing?: string;
  objectives?: string[];
  rules?: string[];
  roles?: RoleDef[];
  decision_sequence?: string[];
  turns?: TurnDefinition[];
  initial_system_states?: SystemStateDef[];
  initial_warfare_domains?: ScenarioWarfareDomainDef[];
  score_tier_thresholds?: Record<string, number>;
  stress_effect_preset?: "off" | "mild" | "standard" | "intense";
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

@Injectable({ providedIn: "root" })
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
    return this.http.post<ScenarioResponse>(
      `${this.base}/api/scenarios`,
      request,
    );
  }

  update(
    id: number,
    request: Partial<CreateScenarioRequest>,
  ): Observable<ScenarioResponse> {
    return this.http.put<ScenarioResponse>(
      `${this.base}/api/scenarios/${id}`,
      request,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/scenarios/${id}`);
  }

  clone(id: number): Observable<ScenarioResponse> {
    return this.http.post<ScenarioResponse>(
      `${this.base}/api/scenarios/${id}/clone`,
      {},
    );
  }
}
