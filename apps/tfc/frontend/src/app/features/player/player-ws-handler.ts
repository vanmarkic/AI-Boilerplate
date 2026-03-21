import type { ExerciseWsService, WsMessage } from "../../core/exercise-ws.service";
import type { ExerciseStore } from "../../core/exercise.store";
import { handleStateChange } from "../../core/ws-state-handler";

type StoreInstance = InstanceType<typeof ExerciseStore>;

export function handlePlayerWsMessage(
  msg: WsMessage,
  store: StoreInstance,
  onStopped?: () => void,
  ws?: ExerciseWsService,
): void {
  switch (msg.type) {
    case "exercise_stopped":
      if (msg.reason === "completed") {
        store.applyPhaseChange("completed");
        ws?.disconnect();
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
        // On phase=completed via state_changes, disconnect WS to prevent reconnect attempts
        if (change.type === "phase_change" && change.phase === "completed") {
          ws?.disconnect();
        }
      }
      break;
  }
}
