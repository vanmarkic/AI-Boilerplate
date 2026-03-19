import type { WsMessage } from "../../core/exercise-ws.service";
import type { ExerciseStore } from "../../core/exercise.store";
import { handleStateChange } from "../../core/ws-state-handler";

type StoreInstance = InstanceType<typeof ExerciseStore>;

export function handleGmWsMessage(
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
    case "presence_update":
      store.updatePresence(msg.participants);
      break;
    case "state_changes":
      for (const change of msg.changes) {
        handleStateChange(change, store);
      }
      break;
  }
}
