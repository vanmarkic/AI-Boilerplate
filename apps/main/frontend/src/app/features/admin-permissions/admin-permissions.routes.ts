import { Routes } from '@angular/router';
import { AdminPermissionsComponent } from './admin-permissions.component';
import { PermissionsTabComponent } from './permissions-tab.component';
import { UsersTabComponent } from './users-tab.component';

export const ADMIN_PERMISSIONS_ROUTES: Routes = [
  {
    path: '',
    component: AdminPermissionsComponent,
    children: [
      { path: '', redirectTo: 'permissions', pathMatch: 'full' },
      { path: 'permissions', component: PermissionsTabComponent },
      { path: 'users', component: UsersTabComponent },
    ],
  },
];
