import type { WsMessage, WsStateChange } from "../../core/exercise-ws.service";
import type { ActiveDecision } from "../../core/decision-api.service";
import type { ExerciseStore } from "../../core/exercise.store";
import type { ParticipantPresence } from "../../core/exercise.store";

type StoreInstance = InstanceType<typeof ExerciseStore>;

/** Handle decision_opened and decision_closed WS state changes */
function handleDecisionChange(
  change: WsStateChange,
  store: StoreInstance,
): void {
  if (change.type === "decision_opened") {
    store.applyDecisions([
      ...store.openDecisions(),
      change as unknown as ActiveDecision,
    ]);
  }
  if (change.type === "decision_closed") {
    store.closeDecision(change["decision_id"] as string);
  }
}

/** Process a single state change from WS */
function handleStateChange(change: WsStateChange, store: StoreInstance): void {
  if (change.type === "phase_change") {
    store.applyPhaseChange(change["phase"] as string);
    if (change["time"]) {
      store.applyTimeUpdate(change["time"] as never);
    }
  }
  if (change.type === "event_change") {
    store.updateEvent(
      change["event_id"] as string,
      change["lifecycle"] as string,
    );
  }
  if (change.type === "issue_change") {
    store.updateIssue(
      change["issue_id"] as string,
      change["lifecycle"] as string,
      change["released"] as boolean,
    );
  }
  handleDecisionChange(change, store);
}

/** Handle a full WS message for the GM view */
export function handleGmWsMessage(
  msg: WsMessage,
  store: StoreInstance,
  onStopped?: () => void,
): void {
  if (msg.type === "exercise_stopped") {
    onStopped?.();
    return;
  }
  if (msg.type === "snapshot") {
    store.applySnapshot(msg as never);
  }
  if (msg.type === "presence_update") {
    store.updatePresence(msg["participants"] as ParticipantPresence[]);
  }
  if (msg.type === "state_changes" && msg.changes) {
    for (const change of msg.changes) {
      handleStateChange(change, store);
    }
  }
}
