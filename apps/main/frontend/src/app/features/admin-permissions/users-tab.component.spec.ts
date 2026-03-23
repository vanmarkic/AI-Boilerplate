import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { UsersTabComponent } from './users-tab.component';
import { UsersTabStore } from './users-tab.store';
import { AuthStore } from '../../shared/auth/auth.store';
import type { KeycloakRole, KeycloakUser } from './admin-permissions.types';

const mockUser: KeycloakUser = {
  id: 'u1',
  username: 'admin@local.dev',
  email: 'admin@local.dev',
  enabled: true,
  roles: ['admin', 'user'],
};

const mockRole: KeycloakRole = {
  id: 'r1',
  name: 'admin',
  description: 'Administrator',
};

describe('UsersTabComponent', () => {
  let fixture: ComponentFixture<UsersTabComponent>;

  const mockStore = {
    users: signal<KeycloakUser[]>([mockUser]),
    allRoles: signal<KeycloakRole[]>([mockRole]),
    total: signal(1),
    loading: signal(false),
    error: signal<string | null>(null),
    search: signal(''),
    loadUsers: vi.fn().mockResolvedValue(undefined),
    loadRoles: vi.fn().mockResolvedValue(undefined),
    assignRoles: vi.fn().mockResolvedValue(undefined),
    removeRoles: vi.fn().mockResolvedValue(undefined),
    createRole: vi.fn().mockResolvedValue(undefined),
    deleteRole: vi.fn().mockResolvedValue(undefined),
  };

  const mockAuth = {
    user: signal({ id: 'u1', email: 'admin@local.dev', roles: ['admin'] }),
    token: signal('fake-token'),
    isAuthenticated: signal(true),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [UsersTabComponent],
    })
      .overrideProvider(UsersTabStore, { useValue: mockStore })
      .overrideProvider(AuthStore, { useValue: mockAuth })
      .compileComponents();
    fixture = TestBed.createComponent(UsersTabComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should call loadUsers and loadRoles on init', () => {
    expect(mockStore.loadUsers).toHaveBeenCalled();
    expect(mockStore.loadRoles).toHaveBeenCalled();
  });

  it('should render the heading', () => {
    const heading = fixture.nativeElement.querySelector('h2') as HTMLElement;
    expect(heading.textContent).toContain('User Management');
  });

  it('should render the search input', () => {
    const input = fixture.nativeElement.querySelector('ui-input') as HTMLElement;
    expect(input).toBeTruthy();
  });
});
