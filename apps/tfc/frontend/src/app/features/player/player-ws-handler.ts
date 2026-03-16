import type { WsStateChange } from '../../core/exercise-ws.service';
import type { ActiveDecision } from '../../core/decision-api.service';
import type { ExerciseStore } from '../../core/exercise.store';

type StoreInstance = InstanceType<typeof ExerciseStore>;

/** Handle decision_opened and decision_closed WS state changes */
export function handleDecisionWsChanges(change: WsStateChange, store: StoreInstance): void {
  if (change.type === 'decision_opened') {
    store.applyDecisions([...store.openDecisions(), change as unknown as ActiveDecision]);
  }
  if (change.type === 'decision_closed') {
    store.closeDecision(change['decision_id'] as string);
  }
}
