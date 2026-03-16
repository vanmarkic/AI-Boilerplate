import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  PageLayoutComponent,
  PageHeaderComponent,
  TabNavComponent,
  TabLinkDirective,
} from '@aspect/ui';

@Component({
  selector: 'app-admin-permissions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    PageLayoutComponent,
    PageHeaderComponent,
    TabNavComponent,
    TabLinkDirective,
  ],
  template: `
    <ui-page-layout>
      <ui-page-header
        pageHeader
        title="Administration"
        subtitle="Manage permissions and users"
      />
      <ui-tab-nav>
        <a uiTabLink routerLink="permissions" routerLinkActive="tab-active">
          Permissions
        </a>
        <a uiTabLink routerLink="users" routerLinkActive="tab-active">
          Users
        </a>
      </ui-tab-nav>
      <router-outlet />
    </ui-page-layout>
  `,
})
export class AdminPermissionsComponent {}
