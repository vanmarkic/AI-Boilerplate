import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { client } from '../../shared/api/generated/client.gen';
import { RegisterComponent } from './register.component';
import { RegisterStore } from './register.store';

describe('RegisterStore', () => {
  let store: InstanceType<typeof RegisterStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RegisterStore],
    });
    store = TestBed.inject(RegisterStore);
    vi.restoreAllMocks();
  });

  it('sets loading during registration', async () => {
    const mockData = { id: 1, email: 'a@b.com', name: 'A', created_at: '' };
    vi.spyOn(client, 'post').mockResolvedValueOnce({ data: mockData } as never);
    const promise = store.register({ email: 'a@b.com', name: 'A' });
    expect(store.loading()).toBe(true);
    await promise;
    expect(store.loading()).toBe(false);
  });

  it('sets success after registration', async () => {
    const mockData = { id: 1, email: 'a@b.com', name: 'A', created_at: '' };
    vi.spyOn(client, 'post').mockResolvedValueOnce({ data: mockData } as never);
    await store.register({ email: 'a@b.com', name: 'A' });
    expect(store.success()).toBe(true);
  });

  it('sets error on failure', async () => {
    vi.spyOn(client, 'post').mockRejectedValueOnce(new Error('409'));
    await store.register({ email: 'dup@b.com', name: 'A' });
    expect(store.error()).toBeTruthy();
    expect(store.success()).toBe(false);
  });
});

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let component: RegisterComponent;

  const mockStore = {
    register: vi.fn().mockResolvedValue(undefined),
    loading: signal(false),
    success: signal(false),
    error: signal<string | null>(null),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStore.loading.set(false);
    mockStore.success.set(false);
    mockStore.error.set(null);

    await TestBed.configureTestingModule({
      imports: [RegisterComponent, ReactiveFormsModule],
    })
      .overrideProvider(RegisterStore, { useValue: mockStore })
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

  it('calls store.register with form values on valid submit', () => {
    component.form.setValue({ name: 'Alice', email: 'alice@example.com' });
    component.onSubmit();
    expect(mockStore.register).toHaveBeenCalledWith({ name: 'Alice', email: 'alice@example.com' });
  });

  it('does not call store when form is invalid', () => {
    component.form.setValue({ name: '', email: 'not-email' });
    component.onSubmit();
    expect(mockStore.register).not.toHaveBeenCalled();
  });
});
