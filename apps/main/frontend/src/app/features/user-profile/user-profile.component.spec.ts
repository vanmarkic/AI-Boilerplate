import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { UserProfileComponent } from './user-profile.component';
import { UserProfileStore } from './user-profile.store';
import { User } from './user-profile.types';

describe('UserProfileComponent', () => {
  let fixture: ComponentFixture<UserProfileComponent>;

  const mockStore = {
    item: signal<User | null>(null),
    items: signal<User[]>([]),
    loading: signal(false),
    error: signal<string | null>(null),
    loadUser: vi.fn(),
    run: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserProfileComponent],
      providers: [{ provide: UserProfileStore, useValue: mockStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(UserProfileComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display loading state', () => {
    mockStore.loading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading...');
  });

  it('should display user name when loaded', () => {
    mockStore.loading.set(false);
    mockStore.item.set({
      id: 1,
      email: 'jane@test.com',
      name: 'Jane Doe',
      created_at: '2026-01-01T00:00:00Z',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Jane Doe');
  });

  it('should display error message', () => {
    mockStore.loading.set(false);
    mockStore.error.set('Failed to load user');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Failed to load user');
  });
});
