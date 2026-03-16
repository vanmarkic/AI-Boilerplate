import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import {
  DataTableComponent,
  DataTableColumnComponent,
  ButtonDirective,
  DialogPanelComponent,
} from '@aspect/ui';
import { PermissionsTabStore } from './permissions-tab.store';
import { PermissionFormComponent, type PermissionFormValue } from './permission-form.component';
import type { PermissionMapping } from './admin-permissions.types';

@Component({
  selector: 'app-permissions-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PermissionsTabStore],
  imports: [
    DataTableComponent,
    DataTableColumnComponent,
    ButtonDirective,
    DialogPanelComponent,
    PermissionFormComponent,
  ],
  template: `
    <div class="flex justify-between items-center mb-md">
      <h2 class="text-lg font-semibold">Role Permissions</h2>
      <button uiButton (click)="showAddDialog.set(true)">Add Permission</button>
    </div>

    @if (store.loading()) {
      <p>Loading...</p>
    } @else if (store.error(); as error) {
      <p class="text-destructive">{{ error }}</p>
    } @else {
      <ui-data-table
        [dataSource]="store.permissions()"
        [clickableRows]="true"
        (rowClick)="onEdit($event)"
      >
        <ui-data-table-column columnDef="role" label="Role" [sortable]="true" />
        <ui-data-table-column
          columnDef="route_pattern"
          label="Route Pattern"
          [sortable]="true"
        />
        <ui-data-table-column columnDef="method" label="Method" />
        <ui-data-table-column columnDef="frontend_route" label="Frontend Route" />
      </ui-data-table>
    }

    @if (showAddDialog() || editingPermission()) {
      <ui-dialog-panel (closed)="closeDialog()">
        <span dialogTitle>
          {{ editingPermission() ? 'Edit' : 'Add' }} Permission
        </span>
        <app-permission-form
          [permission]="editingPermission()"
          (submitted)="onSave($event)"
          (cancelled)="closeDialog()"
        />
      </ui-dialog-panel>
    }
  `,
})
export class PermissionsTabComponent implements OnInit {
  protected readonly store = inject(PermissionsTabStore);
  protected readonly showAddDialog = signal(false);
  protected readonly editingPermission = signal<PermissionMapping | null>(null);

  ngOnInit(): void {
    void this.store.loadPermissions();
  }

  protected onEdit(row: PermissionMapping): void {
    this.editingPermission.set(row);
  }

  protected async onSave(value: PermissionFormValue): Promise<void> {
    const editing = this.editingPermission();
    if (editing) {
      await this.store.updatePermission(editing.id, value);
    } else {
      await this.store.createPermission(value as {
        role: string;
        route_pattern: string;
        method: string;
        frontend_route: string | null;
      });
    }
    await this.store.reloadCache();
    this.closeDialog();
  }

  protected closeDialog(): void {
    this.showAddDialog.set(false);
    this.editingPermission.set(null);
  }
}
