import type { WsMessage } from "../../core/exercise-ws.service";
import type { ExerciseStore } from "../../core/exercise.store";
import { handleStateChange } from "../../core/ws-state-handler";

type StoreInstance = InstanceType<typeof ExerciseStore>;

export function handlePlayerWsMessage(
  msg: WsMessage,
  store: StoreInstance,
  onStopped?: () => void,
): void {
  switch (msg.type) {
    case "exercise_stopped":
      // When exercise completes normally, show the completion overlay instead of navigating away
      if (msg.reason === "completed") {
        store.applyPhaseChange("completed");
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
      }
      break;
  }
}
