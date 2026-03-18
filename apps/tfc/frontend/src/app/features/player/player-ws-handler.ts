import type { WsMessage, WsStateChange } from "../../core/exercise-ws.service";
import type { ActiveDecision } from "../../core/decision-api.service";
import type { ExerciseStore } from "../../core/exercise.store";

type StoreInstance = InstanceType<typeof ExerciseStore>;

/** Handle decision_opened and decision_closed WS state changes */
export function handleDecisionWsChanges(
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

/** Process all state changes from a WS message and apply to store */
export function handlePlayerWsMessage(
  msg: WsMessage,
  store: StoreInstance,
): void {
  if (msg.type === "snapshot") {
    store.applySnapshot(msg as never);
  }
  if (msg.type === "state_changes" && msg.changes) {
    for (const change of msg.changes) {
      if (change.type === "phase_change") {
        store.applyPhaseChange(change["phase"] as string);
        if (change["time"]) store.applyTimeUpdate(change["time"] as never);
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
      handleDecisionWsChanges(change, store);
      if (change.type === "score_change") {
        store.applyScoreChange(change as never);
      }
      if (change.type === "recommendation_submitted") {
        store.applyRecommendation(
          change["decision_id"] as string,
          change["participant_id"] as string,
          change["option_id"] as string,
        );
      }
    }
  }
}
