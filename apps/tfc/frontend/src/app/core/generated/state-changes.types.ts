// @generated — DO NOT EDIT. Regenerate with: python apps/tfc/codegen/generate-types.py
// Source: apps/tfc/backend/engine/state_changes.py

export interface TimeSnapshot {
  play_time_ms: number;
  real_time_ms: number;
  factor: number;
  paused: boolean;
}

export interface EventSnapshot {
  id: string;
  title: string;
  description: string;
  event_type: string;
  scheduled_pt_ms: number;
  duration_ms: number | null;
  dependencies: string[];
  triggered_issues: string[];
  lifecycle: string;
  started_at_pt_ms: number | null;
  completed_at_pt_ms: number | null;
  target_roles: string[];
  role_descriptions: Record<string, string>;
}

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

export interface SystemEffect {
  system_id: string;
  operational_state: string | null;
  power_state: boolean | null;
}

export interface DecisionOptionSnapshot {
  id: string;
  label: string;
  score: number;
  stress_delta: number;
  system_effects: SystemEffect[];
  targets_system: boolean;
  max_plays: number;
  role: string | null;
}

export interface DecisionSnapshot {
  id: string;
  event_id: string | null;
  issue_id: string | null;
  title: string;
  description: string;
  question_type: string;
  options: DecisionOptionSnapshot[];
  completion_mode: string;
  target_roles: string[];
  timeout_ms: number;
  max_selections: number | null;
  status: string;
  opened_at_pt_ms: number;
  closed_at_pt_ms: number | null;
  recommendations: Record<string, string>;
  selected_option_ids: string[];
}

export interface SystemSnapshot {
  system_id: string;
  label: string;
  category: string;
  power: boolean;
  operational: string;
}

export interface EngineSnapshot {
  exercise_id: number;
  title: string;
  phase: string;
  time: TimeSnapshot;
  events: EventSnapshot[];
  issues: IssueSnapshot[];
  decisions: DecisionSnapshot[];
  score: Record<string, object> | null;
  systems: SystemSnapshot[];
}

export interface PresenceEntry {
  id: string;
  display_name: string;
  role: string | null;
  connected: boolean;
}

export interface PhaseChange {
  type: "phase_change";
  action: string;
  phase: string;
  time: TimeSnapshot;
}

/** Domain term: 'inject change'. Code uses 'event_change'. */
export interface EventChange {
  type: "event_change";
  event_id: string;
  action: string;
  lifecycle: string;
  title: string;
  target_roles: string[];
  role_descriptions: Record<string, string>;
}

/** Domain term: 'defect change'. Code uses 'issue_change'. */
export interface IssueChange {
  type: "issue_change";
  issue_id: string;
  action: string;
  lifecycle: string;
  title: string;
  released: boolean;
}

export interface DecisionOpened {
  type: "decision_opened";
  id: string;
  decision_id: string;
  event_id: string | null;
  issue_id: string | null;
  title: string;
  description: string;
  question_type: string;
  options: DecisionOptionSnapshot[];
  completion_mode: string;
  target_roles: string[];
  timeout_ms: number;
  max_selections: number | null;
  status: string;
  opened_at_pt_ms: number;
  closed_at_pt_ms: number | null;
  recommendations: Record<string, string>;
}

export interface DecisionClosed {
  type: "decision_closed";
  decision_id: string;
  title: string;
  selected_option_ids: string[];
}

export interface SpeedChange {
  type: "speed_change";
  factor: number;
}

export interface ScoreChange {
  type: "score_change";
  total_score: number;
  stress: number;
  next_decision_time_ms: number;
  turn_number: number;
}

export interface RecommendationSubmitted {
  type: "recommendation_submitted";
  decision_id: string;
  participant_id: string;
  option_id: string;
}

export interface ForcedCardApplied {
  type: "forced_card_applied";
  decision_id: string;
  forced_option_id: string;
  reason: string;
}

export interface SystemStateChange {
  type: "system_state_change";
  system_id: string;
  action: string;
  power: boolean;
  operational: string;
}

export type StateChange =
  PhaseChange
  | EventChange
  | IssueChange
  | DecisionOpened
  | DecisionClosed
  | SpeedChange
  | ScoreChange
  | RecommendationSubmitted
  | ForcedCardApplied
  | SystemStateChange;
