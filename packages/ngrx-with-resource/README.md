# @aspect/ngrx-with-resource

Reusable NgRx signal store feature for async resource loading. Adds `item`, `items`, `loading`, and `error` state plus a `run()` method that handles the loading/error state machine for any async operation.

## Install

```bash
npm install @aspect/ngrx-with-resource
```

Peer dependencies: `@angular/core` >= 19, `@ngrx/signals` >= 19.

## Usage

```ts
import { signalStore, withMethods } from '@ngrx/signals';
import { patchState } from '@ngrx/signals';
import { withResource } from '@aspect/ngrx-with-resource';

export const OrderStore = signalStore(
  withResource<Order>(),
  withMethods((store) => ({
    async load(id: number) {
      const result = await store.run('load order', () =>
        fetchOrder(id)
      );
      if (result) patchState(store, { item: result });
    },
    async loadAll() {
      const result = await store.run('load orders', () =>
        fetchOrders()
      );
      if (result) patchState(store, { items: result });
    },
  })),
);
```

The store exposes signals: `store.item()`, `store.items()`, `store.loading()`, `store.error()`.
