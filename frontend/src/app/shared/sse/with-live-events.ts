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
 *       reduce: (event) => ({
 *         comments: (prev) => [...prev, event],
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
} from '@ngrx/signals';
import { DestroyRef, inject } from '@angular/core';
import { patchState } from '@ngrx/signals';
import { Subscription } from 'rxjs';
import { EventSourceService } from './event-source.service';

/**
 * Maps an incoming event to a partial state patch.
 * Each value can be a static value or an updater function
 * that receives the current signal store instance.
 */
type EventReducer<TEvent> = (event: TEvent) => Record<string, unknown>;

interface LiveEventsState {
  readonly liveConnected: boolean;
}

/**
 * Add real-time SSE capabilities to a signal store.
 *
 * @param channel - The SSE channel name to subscribe to.
 * @param config.reduce - Pure function that maps an incoming event
 *   to a partial state patch passed to `patchState`.
 */
export function withLiveEvents<TEvent>(
  channel: string,
  config: { reduce: EventReducer<TEvent> },
) {
  return signalStoreFeature(
    withState<LiveEventsState>({ liveConnected: false }),
    withMethods((store) => {
      let subscription: Subscription | null = null;

      return {
        connectLive(): void {
          if (subscription) return;

          const sse = inject(EventSourceService);
          const destroyRef = inject(DestroyRef);

          subscription = sse.channel<TEvent>(channel).subscribe((event) => {
            const patch = config.reduce(event);
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
