import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { DialogPanelComponent, BadgeComponent, ButtonDirective } from '@aspect/ui';
import { AuthStore } from '../../shared/auth/auth.store';
import type { KeycloakRole, KeycloakUser } from './admin-permissions.types';

const PROTECTED_ROLES = new Set(['admin', 'role_manager']);

@Component({
  selector: 'app-user-roles-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogPanelComponent, BadgeComponent, ButtonDirective],
  template: `
    <ui-dialog-panel (closed)="closed.emit()">
      <span dialogTitle>Manage Roles for {{ user().username }}</span>
      <div class="flex flex-col gap-sm">
        @for (role of allRoles(); track role.name) {
          <label class="flex items-center gap-sm">
            <input
              type="checkbox"
              [checked]="selectedRoles().has(role.name)"
              (change)="onToggle(role.name, $event)"
              [disabled]="isProtectedForCurrentUser(role.name)"
            />
            <span>{{ role.name }}</span>
            @if (isProtected(role.name)) {
              <ui-badge [variant]="'secondary'">protected</ui-badge>
            }
          </label>
        }
      </div>
      <ng-container dialogFooter>
        <button uiButton [variant]="'outline'" (click)="closed.emit()">Close</button>
        <button uiButton (click)="onSave()" [disabled]="!hasChanges()">Save Changes</button>
      </ng-container>
    </ui-dialog-panel>
  `,
})
export class UserRolesDialogComponent {
  readonly user = input.required<KeycloakUser>();
  readonly allRoles = input.required<KeycloakRole[]>();
  readonly closed = output();
  readonly rolesChanged = output<{ added: string[]; removed: string[] }>();

  private readonly auth = inject(AuthStore);
  private readonly currentUserIsAdmin = computed(
    () => this.auth.user()?.roles.includes('admin') ?? false,
  );

  protected readonly selectedRoles = linkedSignal<KeycloakUser, Set<string>>({
    source: this.user,
    computation: (user) => new Set(user.roles),
  });

  protected readonly hasChanges = computed(() => {
    const original = new Set(this.user().roles);
    const current = this.selectedRoles();
    if (original.size !== current.size) return true;
    for (const r of current) {
      if (!original.has(r)) return true;
    }
    return false;
  });

  protected isProtected(roleName: string): boolean {
    return PROTECTED_ROLES.has(roleName);
  }

  protected isProtectedForCurrentUser(roleName: string): boolean {
    return this.isProtected(roleName) && !this.currentUserIsAdmin();
  }

  protected onToggle(roleName: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const updated = new Set(this.selectedRoles());
    if (checked) {
      updated.add(roleName);
    } else {
      updated.delete(roleName);
    }
    this.selectedRoles.set(updated);
  }

  protected onSave(): void {
    const original = new Set(this.user().roles);
    const current = this.selectedRoles();
    const added = [...current].filter((r) => !original.has(r));
    const removed = [...original].filter((r) => !current.has(r));
    this.rolesChanged.emit({ added, removed });
  }
}
