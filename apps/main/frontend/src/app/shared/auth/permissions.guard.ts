import { inject } from '@angular/core';
import { CanMatchFn, Route, Router } from '@angular/router';
import { PermissionsStore } from './permissions.store';

/**
 * Route guard that checks whether the current user has permission
 * to access the target route, based on the RBAC permissions store.
 */
export const permissionsGuard: CanMatchFn = (route: Route) => {
  const permissionsStore = inject(PermissionsStore);
  const router = inject(Router);
  const path = '/' + (route.path ?? '');

  if (permissionsStore.isRouteAllowed(path)) {
    return true;
  }

  return router.createUrlTree(['/']);
};
