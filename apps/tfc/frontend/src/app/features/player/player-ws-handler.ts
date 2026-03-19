import type { WsMessage } from "../../core/exercise-ws.service";
import type {
  StateChange,
  DecisionOpened,
} from "../../core/generated/state-changes.types";
import type { ActiveDecision } from "../../core/decision-api.service";
import type { ExerciseStore } from "../../core/exercise.store";

type StoreInstance = InstanceType<typeof ExerciseStore>;

function toActiveDecision(c: DecisionOpened): ActiveDecision {
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
  };
}

function handleStateChange(
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
      store.applyDecisions([
        ...store.openDecisions(),
        toActiveDecision(change),
      ]);
      break;
    case "decision_closed":
      store.closeDecision(change.decision_id);
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
  }
}

/** Process all state changes from a WS message and apply to store */
export function handlePlayerWsMessage(
  msg: WsMessage,
  store: StoreInstance,
  onStopped?: () => void,
): void {
  switch (msg.type) {
    case "exercise_stopped":
      onStopped?.();
      break;
    case "snapshot":
      store.applySnapshot(msg);
      break;
    case "state_changes":
      for (const change of msg.changes) {
        handleStateChange(change, store);
      }
      break;
  }
}
