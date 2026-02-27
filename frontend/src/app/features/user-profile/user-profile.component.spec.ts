import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { UserProfileComponent } from './user-profile.component';
import { UserProfileService } from './user-profile.service';
import { User } from './user-profile.types';

describe('UserProfileComponent', () => {
  let fixture: ComponentFixture<UserProfileComponent>;

  const mockService = {
    user: signal<User | null>(null),
    loading: signal(false),
    error: signal<string | null>(null),
    loadUser: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserProfileComponent],
      providers: [
        { provide: UserProfileService, useValue: mockService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserProfileComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display loading state', () => {
    mockService.loading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading...');
  });

  it('should display user name when loaded', () => {
    mockService.loading.set(false);
    mockService.user.set({
      id: 1,
      email: 'jane@test.com',
      name: 'Jane Doe',
      created_at: '2026-01-01T00:00:00Z',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Jane Doe');
  });

  it('should display error message', () => {
    mockService.loading.set(false);
    mockService.error.set('Failed to load user');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Failed to load user');
  });
});
