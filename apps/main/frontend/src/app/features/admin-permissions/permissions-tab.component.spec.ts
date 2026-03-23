import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PermissionsTabComponent } from './permissions-tab.component';
import { PermissionsTabStore } from './permissions-tab.store';
import type { PermissionMapping } from './admin-permissions.types';

const mockPermission: PermissionMapping = {
  id: 1,
  role: 'admin',
  route_pattern: '/api/admin/**',
  method: '*',
  frontend_route: '/admin',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('PermissionsTabComponent', () => {
  let fixture: ComponentFixture<PermissionsTabComponent>;

  const mockStore = {
    permissions: signal<PermissionMapping[]>([mockPermission]),
    loading: signal(false),
    error: signal<string | null>(null),
    loadPermissions: vi.fn().mockResolvedValue(undefined),
    createPermission: vi.fn().mockResolvedValue(undefined),
    updatePermission: vi.fn().mockResolvedValue(undefined),
    deletePermission: vi.fn().mockResolvedValue(undefined),
    reloadCache: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [PermissionsTabComponent],
    })
      .overrideProvider(PermissionsTabStore, { useValue: mockStore })
      .compileComponents();
    fixture = TestBed.createComponent(PermissionsTabComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should call loadPermissions on init', () => {
    expect(mockStore.loadPermissions).toHaveBeenCalled();
  });

  it('should render the heading', () => {
    const heading = fixture.nativeElement.querySelector('h2') as HTMLElement;
    expect(heading.textContent).toContain('Role Permissions');
  });

  it('should render the Add Permission button', () => {
    const btn = fixture.nativeElement.querySelector('button[uibutton]') as HTMLButtonElement;
    expect(btn.textContent).toContain('Add Permission');
  });
});
