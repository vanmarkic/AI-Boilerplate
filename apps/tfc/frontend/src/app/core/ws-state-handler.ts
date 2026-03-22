import type { ActiveDecision } from "./decision-api.service";
import type { ExerciseStore } from "./exercise.store";
import type {
  StateChange,
  DecisionOpened,
} from "./generated/state-changes.types";

type StoreInstance = InstanceType<typeof ExerciseStore>;

/** Convert a decision_opened state change to an ActiveDecision for the store. */
export function toActiveDecision(c: DecisionOpened): ActiveDecision {
  return {
    id: c.id,
    event_id: c.event_id,
    issue_id: c.issue_id,
    title: c.title,
    description: c.description,
    question_type: c.question_type,
    options: c.options,
    completion_mode: c.completion_mode,
    target_roles: c.target_roles,
    timeout_ms: c.timeout_ms,
    max_selections: c.max_selections,
    status: "open",
    opened_at_pt_ms: c.opened_at_pt_ms,
    closed_at_pt_ms: null,
    recommendations: c.recommendations ?? {},
    selected_option_ids: [],
  };
}

/** Apply a single state change to the exercise store. */
export function handleStateChange(
  change: StateChange,
  store: StoreInstance,
): void {
  switch (change.type) {
    case "phase_change":
      store.applyPhaseChange(change.phase);
      store.applyTimeUpdate(change.time);
      break;
    case "event_change":
      store.updateEvent(change.event_id, change.lifecycle);
      break;
    case "issue_change":
      store.updateIssue(change.issue_id, change.lifecycle, change.released);
      break;
    case "decision_opened":
      store.applyDecisions([...store.decisions(), toActiveDecision(change)]);
      break;
    case "decision_closed":
      store.closeDecision(change.decision_id, change.selected_option_ids);
      break;
    case "score_change":
      store.applyScoreChange(change);
      break;
    case "recommendation_submitted":
      store.applyRecommendation(
        change.decision_id,
        change.participant_id,
        change.option_id,
      );
      break;
    case "speed_change":
      store.setSpeedFactor(change.factor);
      break;
    case "forced_card_applied":
      // No UI action needed — forced cards are reflected in the decision's options
      break;
    case "system_state_change":
      store.applySystemChange(change);
      break;
    case "warfare_domain_change":
      store.applyWarfareDomainChange(change);
      break;
  }
}
