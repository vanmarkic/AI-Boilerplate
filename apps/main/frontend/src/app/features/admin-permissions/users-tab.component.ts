import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import {
  DataTableComponent,
  DataTableColumnComponent,
  BadgeComponent,
  InputComponent,
} from '@aspect/ui';
import { UsersTabStore } from './users-tab.store';
import { UserRolesDialogComponent } from './user-roles-dialog.component';
import { RolesManagementComponent } from './roles-management.component';
import type { KeycloakUser } from './admin-permissions.types';

@Component({
  selector: 'app-users-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [UsersTabStore],
  imports: [
    DataTableComponent,
    DataTableColumnComponent,
    BadgeComponent,
    InputComponent,
    UserRolesDialogComponent,
    RolesManagementComponent,
  ],
  template: `
    <div class="flex justify-between items-center mb-md">
      <h2 class="text-lg font-semibold">User Management</h2>
      <ui-input placeholder="Search users..." (valueChange)="onSearch($event)" />
    </div>

    @if (store.loading()) {
      <p>Loading...</p>
    } @else if (store.error(); as error) {
      <p class="text-destructive">{{ error }}</p>
    } @else {
      <ui-data-table
        [dataSource]="store.users()"
        [clickableRows]="true"
        (rowClick)="onSelectUser($event)"
      >
        <ui-data-table-column columnDef="username" label="Username" [sortable]="true" />
        <ui-data-table-column columnDef="email" label="Email" [sortable]="true" />
        <ui-data-table-column columnDef="enabled" label="Status">
          <ng-template #cell let-row>
            <ui-badge [variant]="row.enabled ? 'default' : 'destructive'">
              {{ row.enabled ? 'Active' : 'Disabled' }}
            </ui-badge>
          </ng-template>
        </ui-data-table-column>
        <ui-data-table-column columnDef="roles" label="Roles">
          <ng-template #cell let-row>
            @for (role of row.roles; track role) {
              <ui-badge [variant]="'outline'" class="mr-xs">{{ role }}</ui-badge>
            }
          </ng-template>
        </ui-data-table-column>
      </ui-data-table>
    }

    <div class="mt-lg">
      <app-roles-management />
    </div>

    @if (selectedUser()) {
      <app-user-roles-dialog
        [user]="selectedUser()!"
        [allRoles]="store.allRoles()"
        (closed)="selectedUser.set(null)"
        (rolesChanged)="onRolesChanged($event)"
      />
    }
  `,
})
export class UsersTabComponent implements OnInit {
  protected readonly store = inject(UsersTabStore);
  protected readonly selectedUser = signal<KeycloakUser | null>(null);

  ngOnInit(): void {
    void this.store.loadUsers();
    void this.store.loadRoles();
  }

  protected onSearch(value: string): void {
    void this.store.loadUsers(value || undefined);
  }

  protected onSelectUser(user: KeycloakUser): void {
    this.selectedUser.set(user);
  }

  protected async onRolesChanged(changes: { added: string[]; removed: string[] }): Promise<void> {
    const user = this.selectedUser();
    if (!user) return;
    if (changes.added.length > 0) {
      await this.store.assignRoles(user.id, changes.added);
    }
    if (changes.removed.length > 0) {
      await this.store.removeRoles(user.id, changes.removed);
    }
    this.selectedUser.set(null);
  }
}
