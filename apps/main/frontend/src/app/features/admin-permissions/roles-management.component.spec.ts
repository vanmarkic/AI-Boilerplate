import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { RolesManagementComponent } from './roles-management.component';
import { UsersTabStore } from './users-tab.store';
import { AuthStore } from '../../shared/auth/auth.store';
import type { KeycloakRole } from './admin-permissions.types';

describe('RolesManagementComponent', () => {
  let fixture: ComponentFixture<RolesManagementComponent>;

  const mockStore = {
    allRoles: signal<KeycloakRole[]>([
      { id: 'r1', name: 'admin', description: null },
      { id: 'r2', name: 'user', description: null },
      { id: 'r3', name: 'custom', description: 'A custom role' },
    ]),
    users: signal([]),
    total: signal(0),
    loading: signal(false),
    error: signal<string | null>(null),
    search: signal(''),
    loadUsers: vi.fn(),
    loadRoles: vi.fn(),
    assignRoles: vi.fn(),
    removeRoles: vi.fn(),
    createRole: vi.fn().mockResolvedValue(undefined),
    deleteRole: vi.fn().mockResolvedValue(undefined),
  };

  const mockAuth = {
    user: signal({ id: 'a1', email: 'admin@test.dev', roles: ['admin'] }),
    token: signal('token'),
    isAuthenticated: signal(true),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [RolesManagementComponent],
    })
      .overrideProvider(UsersTabStore, { useValue: mockStore })
      .overrideProvider(AuthStore, { useValue: mockAuth })
      .compileComponents();
    fixture = TestBed.createComponent(RolesManagementComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show Create Role button for admin', () => {
    const btn = Array.from(
      fixture.nativeElement.querySelectorAll('button[uibutton]'),
    ).find((b) =>
      (b as HTMLElement).textContent?.includes('Create Role'),
    );
    expect(btn).toBeTruthy();
  });

  it('should show Delete button only for non-system roles', () => {
    const deleteBtns = Array.from(
      fixture.nativeElement.querySelectorAll(
        'button[uibutton][data-variant="destructive"]',
      ),
    );
    expect(deleteBtns.length).toBe(1);
  });
});
