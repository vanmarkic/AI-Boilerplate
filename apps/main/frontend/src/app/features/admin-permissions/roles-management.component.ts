import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  BadgeComponent,
  ButtonDirective,
  CollapsiblePanelComponent,
  DialogPanelComponent,
  InputComponent,
  FormErrorComponent,
} from '@aspect/ui';
import { AuthStore } from '../../shared/auth/auth.store';
import { UsersTabStore } from './users-tab.store';

const UNDELETABLE_ROLES = new Set(['admin', 'role_manager', 'user']);

@Component({
  selector: 'app-roles-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    BadgeComponent,
    ButtonDirective,
    CollapsiblePanelComponent,
    DialogPanelComponent,
    InputComponent,
    FormErrorComponent,
  ],
  template: `
    <ui-collapsible-panel>
      <span slot="header" class="font-semibold">Realm Roles</span>
      <div class="flex flex-col gap-sm">
        @for (role of store.allRoles(); track role.name) {
          <div class="flex items-center justify-between p-sm">
            <div class="flex items-center gap-sm">
              <span>{{ role.name }}</span>
              @if (isUndeletable(role.name)) {
                <ui-badge [variant]="'secondary'">system</ui-badge>
              }
            </div>
            @if (isAdmin() && !isUndeletable(role.name)) {
              <button
                uiButton
                [variant]="'destructive'"
                [size]="'sm'"
                (click)="onDelete(role.name)"
              >
                Delete
              </button>
            }
          </div>
        }
      </div>
      @if (isAdmin()) {
        <div class="mt-md">
          <button uiButton (click)="showCreateDialog.set(true)">Create Role</button>
        </div>
      }
    </ui-collapsible-panel>

    @if (showCreateDialog()) {
      <ui-dialog-panel (closed)="showCreateDialog.set(false)">
        <span dialogTitle>Create New Role</span>
        <form
          [formGroup]="createForm"
          (ngSubmit)="onCreate()"
          class="flex flex-col gap-md"
        >
          <ui-input formControlName="name" label="Role Name" placeholder="lowercase_snake" />
          <ui-form-error [control]="createForm.controls.name" />
          <ui-input formControlName="description" label="Description" />
        </form>
        <ng-container dialogFooter>
          <button uiButton [variant]="'outline'" (click)="showCreateDialog.set(false)">
            Cancel
          </button>
          <button uiButton (click)="onCreate()">Create</button>
        </ng-container>
      </ui-dialog-panel>
    }
  `,
})
export class RolesManagementComponent {
  protected readonly store = inject(UsersTabStore);
  private readonly auth = inject(AuthStore);
  protected readonly showCreateDialog = signal(false);

  protected readonly isAdmin = computed(
    () => this.auth.user()?.roles.includes('admin') ?? false,
  );

  readonly createForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[a-z][a-z0-9_]*$/)],
    }),
    description: new FormControl('', { nonNullable: true }),
  });

  protected isUndeletable(name: string): boolean {
    return UNDELETABLE_ROLES.has(name);
  }

  protected async onDelete(name: string): Promise<void> {
    await this.store.deleteRole(name);
  }

  protected async onCreate(): Promise<void> {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid) return;
    const { name, description } = this.createForm.getRawValue();
    await this.store.createRole(name, description);
    this.createForm.reset();
    this.showCreateDialog.set(false);
  }
}
