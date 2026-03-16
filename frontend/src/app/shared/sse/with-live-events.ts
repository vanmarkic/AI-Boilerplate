/**
 * NgRx SignalStore custom feature: `withLiveEvents`.
 *
 * Connects a signal store to an SSE channel and appends incoming events
 * to a signal-based collection. Handles subscribe/unsubscribe lifecycle
 * via explicit init()/destroy() hooks that the component calls.
 *
 * Usage in a feature store:
 *
 *   export const CommentStore = signalStore(
 *     withState<CommentState>({ comments: [], loading: false }),
 *     withLiveEvents<CommentResponse>('comments', {
 *       append: (state, event) => ({
 *         ...state,
 *         comments: [...state.comments, event],
 *       }),
 *     }),
 *     withMethods((store) => ({ ... })),
 *   );
 *
 * In the component:
 *
 *   readonly store = inject(CommentStore);
 *   constructor() {
 *     this.store.connectLive();
 *     // auto-disconnects via DestroyRef
 *   }
 */

import {
  signalStoreFeature,
  withMethods,
  withState,
  type,
  withHooks,
} from '@ngrx/signals';
import { DestroyRef, inject } from '@angular/core';
import { patchState } from '@ngrx/signals';
import { Subscription } from 'rxjs';
import { EventSourceService } from './event-source.service';

type Updater<TState extends object, TEvent> = (
  state: TState,
  event: TEvent,
) => Partial<TState>;

interface LiveEventsState {
  readonly liveConnected: boolean;
}

/**
 * Add real-time SSE capabilities to any signal store.
 *
 * @param channel  - The SSE channel name to subscribe to.
 * @param config.append - Pure function: receives current state + incoming
 *   event, returns a partial state update (like a reducer).
 */
export function withLiveEvents<
  TEvent,
  TState extends object = object,
>(
  channel: string,
  config: { append: Updater<TState, TEvent> },
) {
  return signalStoreFeature(
    { state: type<TState>() },
    withState<LiveEventsState>({ liveConnected: false }),
    withMethods((store: any) => {
      let subscription: Subscription | null = null;

      return {
        connectLive(): void {
          if (subscription) return;

          const sse = inject(EventSourceService);
          const destroyRef = inject(DestroyRef);

          subscription = sse.channel<TEvent>(channel).subscribe((event) => {
            const currentState = Object.fromEntries(
              Object.entries(store).filter(
                ([, v]) => typeof v === 'function' && 'asReadonly' in (v as any),
              ).map(([k, v]) => [k, (v as any)()]),
            ) as TState;
            const patch = config.append(currentState, event);
            patchState(store, { ...patch, liveConnected: true });
          });

          patchState(store, { liveConnected: true });

          destroyRef.onDestroy(() => {
            subscription?.unsubscribe();
            subscription = null;
            patchState(store, { liveConnected: false });
          });
        },

        disconnectLive(): void {
          subscription?.unsubscribe();
          subscription = null;
          patchState(store, { liveConnected: false });
        },
      };
    }),
  );
}
