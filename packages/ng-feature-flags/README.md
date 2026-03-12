# @aspect/ng-feature-flags

Lightweight Angular feature flags using signals. Provides a `FeatureFlagService` for checking flags and a `featureGuard` factory for protecting routes.

## Install

```bash
npm install @aspect/ng-feature-flags
```

Peer dependencies: `@angular/core` >= 19, `@angular/router` >= 19.

## Usage

### Bootstrap

```ts
import { FeatureFlagService } from '@aspect/ng-feature-flags';

// In your app initializer or bootstrap logic:
const flagService = inject(FeatureFlagService);
flagService.setFlags({ analytics: true, 'beta-dashboard': false });
```

### Check flags in components

```ts
const flagService = inject(FeatureFlagService);
if (flagService.isEnabled('analytics')) {
  // show analytics UI
}
```

### Protect routes

```ts
import { featureGuard } from '@aspect/ng-feature-flags';

export const routes: Routes = [
  {
    path: 'analytics',
    canActivate: [featureGuard('analytics')],
    loadComponent: () => import('./analytics.component'),
  },
];
```

Flags default to `true` — shipped features are active unless explicitly disabled.
