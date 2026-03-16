import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-admin-permissions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Permissions Management</h1>
    <p>Use the API to manage role-permission mappings.</p>
  `,
})
export class AdminPermissionsComponent {}
