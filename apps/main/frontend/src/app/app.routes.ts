import { Routes } from '@angular/router';
import { authGuard } from './shared/auth/auth.guard';
import { permissionsGuard } from './shared/auth/permissions.guard';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/landing/landing.routes').then((m) => m.LANDING_ROUTES),
  },
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
    canActivate: [authGuard],
    canMatch: [permissionsGuard],
  },
  {
    path: 'profile',
    loadChildren: () =>
      import('./features/user-profile/user-profile.routes').then((m) => m.USER_PROFILE_ROUTES),
    canActivate: [authGuard],
    canMatch: [permissionsGuard],
  },
  {
    path: 'admin',
    loadChildren: () =>
      import('./features/admin-permissions/admin-permissions.routes').then(
        (m) => m.ADMIN_PERMISSIONS_ROUTES,
      ),
    canActivate: [authGuard],
    canMatch: [permissionsGuard],
  },
  {
    path: 'register',
    loadChildren: () =>
      import('./features/register/register.routes').then((m) => m.REGISTER_ROUTES),
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'canary',
    loadChildren: () => import('./features/canary/canary.routes').then((m) => m.CANARY_ROUTES),
  },
];
