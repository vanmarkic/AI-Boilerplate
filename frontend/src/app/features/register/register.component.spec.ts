import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { client } from '../../shared/api/generated/client.gen';
import { RegisterComponent } from './register.component';
import { RegisterService } from './register.service';

describe('RegisterService', () => {
  let service: RegisterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RegisterService);
    vi.restoreAllMocks();
  });

  it('sets loading during registration', async () => {
    const mockData = { id: 1, email: 'a@b.com', name: 'A', created_at: '' };
    vi.spyOn(client, 'post').mockResolvedValueOnce({ data: mockData } as never);
    const promise = service.register({ email: 'a@b.com', name: 'A' });
    expect(service.loading()).toBe(true);
    await promise;
    expect(service.loading()).toBe(false);
  });

  it('sets success after registration', async () => {
    const mockData = { id: 1, email: 'a@b.com', name: 'A', created_at: '' };
    vi.spyOn(client, 'post').mockResolvedValueOnce({ data: mockData } as never);
    await service.register({ email: 'a@b.com', name: 'A' });
    expect(service.success()).toBe(true);
  });

  it('sets error on failure', async () => {
    vi.spyOn(client, 'post').mockRejectedValueOnce(new Error('409'));
    await service.register({ email: 'dup@b.com', name: 'A' });
    expect(service.error()).toBeTruthy();
    expect(service.success()).toBe(false);
  });
});

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let component: RegisterComponent;

  const mockService = {
    register: vi.fn().mockResolvedValue(undefined),
    loading: signal(false),
    success: signal(false),
    error: signal<string | null>(null),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockService.loading.set(false);
    mockService.success.set(false);
    mockService.error.set(null);

    await TestBed.configureTestingModule({
      imports: [RegisterComponent, ReactiveFormsModule],
    })
      .overrideProvider(RegisterService, { useValue: mockService })
      .compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('submit button is disabled when form is invalid', () => {
    const btn = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
  });

  it('calls service.register with form values on valid submit', () => {
    component.form.setValue({ name: 'Alice', email: 'alice@example.com' });
    component.onSubmit();
    expect(mockService.register).toHaveBeenCalledWith({ name: 'Alice', email: 'alice@example.com' });
  });

  it('does not call service when form is invalid', () => {
    component.form.setValue({ name: '', email: 'not-email' });
    component.onSubmit();
    expect(mockService.register).not.toHaveBeenCalled();
  });
});
