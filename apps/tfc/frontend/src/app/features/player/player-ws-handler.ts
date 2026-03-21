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
      // Don't navigate away if completed — let the completion overlay handle it
      if (store.phase() !== "completed") {
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
