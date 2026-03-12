import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FeatureFlagService } from './feature-flag.service';

export function featureGuard(featureName: string): CanActivateFn {
  return () => {
    const flagService = inject(FeatureFlagService);
    const router = inject(Router);

    if (flagService.isEnabled(featureName)) {
      return true;
    }
    return router.createUrlTree(['/']);
  };
}
