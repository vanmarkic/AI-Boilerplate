import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { UserRolesDialogComponent } from './user-roles-dialog.component';
import { AuthStore } from '../../shared/auth/auth.store';
import type { KeycloakRole, KeycloakUser } from './admin-permissions.types';

const mockUser: KeycloakUser = {
  id: 'u1',
  username: 'alice',
  email: 'alice@test.dev',
  enabled: true,
  roles: ['user'],
};

const mockRoles: KeycloakRole[] = [
  { id: 'r1', name: 'admin', description: 'Administrator' },
  { id: 'r2', name: 'user', description: 'Regular user' },
  { id: 'r3', name: 'custom', description: 'Custom role' },
];

describe('UserRolesDialogComponent', () => {
  let fixture: ComponentFixture<UserRolesDialogComponent>;
  let component: UserRolesDialogComponent;

  const mockAuth = {
    user: signal({ id: 'a1', email: 'admin@test.dev', roles: ['admin'] }),
    token: signal('token'),
    isAuthenticated: signal(true),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserRolesDialogComponent],
    })
      .overrideProvider(AuthStore, { useValue: mockAuth })
      .compileComponents();

    fixture = TestBed.createComponent(UserRolesDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('user', mockUser);
    fixture.componentRef.setInput('allRoles', mockRoles);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render checkboxes for all roles', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(3);
  });

  it('should have user role pre-checked', () => {
    const checkboxes: HTMLInputElement[] = Array.from(
      fixture.nativeElement.querySelectorAll(
        'input[type="checkbox"]',
      ) as NodeListOf<HTMLInputElement>,
    );
    const userCheckbox = checkboxes.find((cb) => {
      const label = cb.closest('label');
      return label?.textContent.includes('user');
    });
    expect(userCheckbox?.checked).toBe(true);
  });

  it('should emit rolesChanged on save with changes', () => {
    const spy = vi.fn();
    component.rolesChanged.subscribe(spy);

    // Toggle 'custom' on
    const checkboxes: HTMLInputElement[] = Array.from(
      fixture.nativeElement.querySelectorAll(
        'input[type="checkbox"]',
      ) as NodeListOf<HTMLInputElement>,
    );
    const customCb = checkboxes.find((cb) => {
      const label = cb.closest('label');
      return label?.textContent.includes('custom');
    });
    customCb?.click();
    fixture.detectChanges();

    const buttons: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button[uibutton]') as NodeListOf<HTMLElement>,
    );
    const saveBtn = buttons.find((b) => b.textContent.includes('Save'));
    saveBtn?.click();

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ added: ['custom'], removed: [] }));
  });
});
