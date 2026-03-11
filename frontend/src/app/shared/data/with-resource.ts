import {
  patchState,
  signalStoreFeature,
  withMethods,
  withState,
} from '@ngrx/signals';

/**
 * Reusable NgRx signal store feature for async resource loading.
 *
 * Provides item/items/loading/error state and a `run()` helper
 * that wraps async operations with loading/error handling.
 *
 * Usage:
 *   export const OrderStore = signalStore(
 *     withResource<Order>(),
 *     withMethods((store) => ({
 *       async load(id: number) {
 *         const result = await store.run('load order', () =>
 *           getOrder({ path: { id } }).then(r => r.data!)
 *         );
 *         if (result) patchState(store, { item: result });
 *       },
 *     })),
 *   );
 */
export function withResource<T>() {
  return signalStoreFeature(
    withState({
      item: null as T | null,
      items: [] as T[],
      loading: false,
      error: null as string | null,
    }),
    withMethods((store) => ({
      async run(
        label: string,
        operation: () => Promise<T>,
      ): Promise<T | undefined> {
        patchState(store, { loading: true, error: null });
        try {
          const result = await operation();
          return result;
        } catch {
          patchState(store, { error: `Failed to ${label}` });
          return undefined;
        } finally {
          patchState(store, { loading: false });
        }
      },
    })),
  );
}
