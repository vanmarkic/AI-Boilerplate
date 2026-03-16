import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PageLayoutComponent, PageHeaderComponent } from '@aspect/ui';

@Component({
  selector: 'app-admin-permissions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, PageLayoutComponent, PageHeaderComponent],
  template: `
    <ui-page-layout>
      <ui-page-header
        pageHeader
        title="Administration"
        subtitle="Manage permissions and users"
      />
      <nav class="tab-nav">
        <a routerLink="permissions" routerLinkActive="tab-active" class="tab-link">
          Permissions
        </a>
        <a routerLink="users" routerLinkActive="tab-active" class="tab-link">
          Users
        </a>
      </nav>
      <router-outlet />
    </ui-page-layout>
  `,
})
export class AdminPermissionsComponent {}
