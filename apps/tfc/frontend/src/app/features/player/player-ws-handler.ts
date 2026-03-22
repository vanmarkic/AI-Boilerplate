import type { ExerciseWsService, WsMessage } from "../../core/exercise-ws.service";
import type { ExerciseStore } from "../../core/exercise.store";
import { handleStateChange } from "../../core/ws-state-handler";

type StoreInstance = InstanceType<typeof ExerciseStore>;

/** Canonical completion handler — one path for all completion detection. */
function handleCompletion(store: StoreInstance, ws?: ExerciseWsService): void {
  store.applyPhaseChange("completed");
  ws?.disconnect();
}

export function handlePlayerWsMessage(
  msg: WsMessage,
  store: StoreInstance,
  onStopped?: () => void,
  ws?: ExerciseWsService,
): void {
  switch (msg.type) {
    case "exercise_stopped":
      if (msg.reason === "completed") {
        handleCompletion(store, ws);
      } else {
        onStopped?.();
      }
      break;
    case "snapshot":
      store.applySnapshot(msg);
      break;
    case "state_changes":
      for (const change of msg.changes) {
        handleStateChange(change, store);
        if (change.type === "phase_change" && change.phase === "completed") {
          handleCompletion(store, ws);
        }
      }
      break;
  }
}
