# API Client Codegen + Angular Reactive Forms — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire up the existing OpenAPI codegen script so services use generated typed functions, and add an Angular reactive forms pattern via a Register feature that demonstrates typed `FormGroup` + validation + `ControlValueAccessor` on `InputComponent`.

**Architecture:** Generated fetch client (`@hey-api/client-fetch`) configured once in `main.ts`; services import generated SDK functions instead of calling `HttpClient` directly. `InputComponent` gains `ControlValueAccessor` for reactive form binding. New `register` feature wires everything together end-to-end.

**Tech Stack:** Angular 19+, `@hey-api/openapi-ts`, `@hey-api/client-fetch`, Angular `ReactiveFormsModule`, vitest (via `ng test`)

**Working directory:** `/Users/dragan/AI-Boilerplate/.worktrees/api-codegen-forms`
**Test command (frontend):** `cd frontend && npx ng test --watch=false`
**Test command (backend):** `PYTHONPATH=backend backend/.venv/bin/pytest backend/features -q`

---

## Task 1: Fix pre-existing spec failures (jasmine → vitest)

The existing specs use `jasmine.createSpy()` which doesn't exist in vitest. Two files need fixing before we can verify our own tests pass.

**Files:**
- Modify: `frontend/src/app/features/auth/login.component.spec.ts`
- Modify: `frontend/src/app/features/user-profile/user-profile.component.spec.ts`

**Step 1: Fix login.component.spec.ts**

Replace `jasmine.createSpy(...)` with `vi.fn()`. Open the file and change:

```ts
// BEFORE — broken
providers: [
  { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
]

// AFTER — vitest
import { vi } from 'vitest';
// ...
providers: [
  { provide: Router, useValue: { navigate: vi.fn() } },
]
```

**Step 2: Fix user-profile.component.spec.ts**

Same change — replace `jasmine.createSpy('loadUser')` with `vi.fn()`.

```ts
// BEFORE
loadUser: jasmine.createSpy('loadUser'),

// AFTER
import { vi } from 'vitest';
// ...
loadUser: vi.fn(),
```

**Step 3: Run tests to verify baseline compiles**

```bash
cd frontend && npx ng test --watch=false 2>&1 | tail -20
```

Expected: Tests run (may still fail on assertions), but no TypeScript errors for `jasmine` not found.

**Step 4: Commit**

```bash
git add frontend/src/app/features/auth/login.component.spec.ts \
        frontend/src/app/features/user-profile/user-profile.component.spec.ts
git commit -m "fix: replace jasmine.createSpy with vi.fn() in existing specs"
```

---

## Task 2: Install API codegen packages + generate client

**Files:**
- Modify: `frontend/package.json`
- Generate: `frontend/src/app/shared/api/generated/` (auto-generated, do not edit)

**Step 1: Add packages to package.json devDependencies**

In `frontend/package.json`, add to `devDependencies`:

```json
"@hey-api/client-fetch": "^0.9.0",
"@hey-api/openapi-ts": "^0.64.0"
```

**Step 2: Install**

```bash
cd frontend && npm install
```

Expected: No errors, packages appear in `node_modules/@hey-api/`.

**Step 3: Run the generate script**

From the repo root (worktree root):

```bash
bash shared/scripts/generate-frontend.sh
```

Expected output:
```
Generating TypeScript client from OpenAPI spec...
✓ Frontend API client generated at frontend/src/app/shared/api/generated/
```

**Step 4: Verify generated files**

```bash
ls frontend/src/app/shared/api/generated/
```

Expected: Several files including `types.gen.ts`, `sdk.gen.ts`, `@tanstack/...` or similar. Check that `types.gen.ts` contains `CreateUserRequest`, `UserResponse` types.

```bash
cat frontend/src/app/shared/api/generated/types.gen.ts | head -50
```

**Step 5: Check generated SDK functions**

```bash
grep -n "export const" frontend/src/app/shared/api/generated/sdk.gen.ts
```

Expected: `createUser`, `getUser`, `healthCheck` functions exported.

**Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: install @hey-api/openapi-ts and generate API client"
```

Note: Generated files are gitignored (`frontend/src/app/shared/api/generated/`), so don't commit them.

---

## Task 3: Configure generated client in main.ts

The fetch client needs a base URL before any services use it.

**Files:**
- Modify: `frontend/src/main.ts`

**Step 1: Read current main.ts**

```bash
cat frontend/src/main.ts
```

**Step 2: Add client configuration**

Import and configure the client before `bootstrapApplication`. The exact import path depends on what was generated — check with `grep -r "export.*client" frontend/src/app/shared/api/generated/`.

```ts
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { client } from './app/shared/api/generated';  // adjust if path differs
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { environment } from './app/core/environment';

client.setConfig({ baseUrl: environment.apiBaseUrl });

bootstrapApplication(App, appConfig).catch(console.error);
```

**Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx ng build --configuration=development 2>&1 | tail -20
```

Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add frontend/src/main.ts
git commit -m "feat: configure generated API client base URL in main.ts"
```

---

## Task 4: Update user-profile.service.ts to use generated client

This is the "before/after" example that shows agents how to use the generated functions.

**Files:**
- Modify: `frontend/src/app/features/user-profile/user-profile.service.ts`
- Modify: `frontend/src/app/features/user-profile/user-profile.component.spec.ts`

**Step 1: Read the current service**

```bash
cat frontend/src/app/features/user-profile/user-profile.service.ts
```

**Step 2: Update the service**

Replace the manual `HttpClient` call with the generated `getUser` function:

```ts
import { Injectable, signal } from '@angular/core';
import { getUser } from '../../shared/api/generated';
import { User } from './user-profile.types';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  readonly user = signal<User | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async loadUser(id: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const { data } = await getUser({ path: { id } });
      this.user.set(data ?? null);
    } catch {
      this.error.set('Failed to load user');
    } finally {
      this.loading.set(false);
    }
  }
}
```

Note: The generated function signature may differ. Check `sdk.gen.ts` for the exact parameter shape.

**Step 3: Update the spec to mock generated client**

```ts
import { vi } from 'vitest';

// Mock the entire generated module
vi.mock('../../shared/api/generated', () => ({
  getUser: vi.fn(),
}));

import { getUser } from '../../shared/api/generated';
// ... rest of spec uses (getUser as ReturnType<typeof vi.fn>)
```

**Step 4: Run tests**

```bash
cd frontend && npx ng test --watch=false --include="**/user-profile/**" 2>&1 | tail -20
```

**Step 5: Commit**

```bash
git add frontend/src/app/features/user-profile/
git commit -m "refactor: use generated getUser() in user-profile service"
```

---

## Task 5: Add ControlValueAccessor to InputComponent

This makes `<app-input formControlName="email" />` work in reactive forms.

**Files:**
- Modify: `frontend/src/app/shared/ui/input.component.ts`
- Create: `frontend/src/app/shared/ui/input.component.spec.ts` (replace existing)

**Step 1: Write the failing test first**

Create `frontend/src/app/shared/ui/input.component.spec.ts`:

```ts
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputComponent } from './input.component';

@Component({
  template: `<app-input [formControl]="control" />`,
  imports: [InputComponent, ReactiveFormsModule],
})
class TestHostComponent {
  control = new FormControl('', { nonNullable: true });
}

describe('InputComponent — ControlValueAccessor', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('writes value from FormControl to the input element', () => {
    host.control.setValue('hello');
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input');
    expect(input.value).toBe('hello');
  });

  it('propagates typed value back to FormControl', () => {
    const input = fixture.nativeElement.querySelector('input');
    input.value = 'world';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.control.value).toBe('world');
  });

  it('disables the input when FormControl is disabled', () => {
    host.control.disable();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input');
    expect(input.disabled).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npx ng test --watch=false --include="**/input.component.spec.ts" 2>&1 | tail -20
```

Expected: FAIL — `InputComponent` doesn't implement `ControlValueAccessor` yet.

**Step 3: Implement ControlValueAccessor**

Update `frontend/src/app/shared/ui/input.component.ts`:

```ts
import { Component, forwardRef, input, model } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../utils';

@Component({
  selector: 'app-input',
  imports: [FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
  template: `
    @if (label()) {
      <label [for]="id()" class="block text-sm font-medium text-foreground mb-xs">
        {{ label() }}
      </label>
    }
    <input
      [id]="id()"
      [type]="type()"
      [placeholder]="placeholder()"
      [value]="currentValue"
      [disabled]="isDisabled"
      (input)="onInput($event)"
      (blur)="onTouched()"
      [class]="inputClasses"
    />
  `,
  host: { 'class': 'block mb-sm' },
})
export class InputComponent implements ControlValueAccessor {
  readonly id = input('');
  readonly label = input('');
  readonly type = input<'text' | 'email' | 'password'>('text');
  readonly placeholder = input('');
  readonly value = model('');  // kept for ngModel backwards-compat

  protected currentValue = '';
  protected isDisabled = false;

  private onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  readonly inputClasses = cn(
    'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1',
    'text-sm text-foreground placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  );

  writeValue(value: string): void {
    this.currentValue = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.currentValue = value;
    this.onChange(value);
    this.value.set(value);  // keep model() in sync for ngModel users
  }
}
```

**Step 4: Run tests**

```bash
cd frontend && npx ng test --watch=false --include="**/input.component.spec.ts" 2>&1 | tail -20
```

Expected: 3 tests PASS.

**Step 5: Commit**

```bash
git add frontend/src/app/shared/ui/input.component.ts \
        frontend/src/app/shared/ui/input.component.spec.ts
git commit -m "feat: add ControlValueAccessor to InputComponent for reactive forms"
```

---

## Task 6: Create FormErrorComponent

A reusable primitive that displays validation error messages for a `FormControl`.

**Files:**
- Create: `frontend/src/app/shared/ui/form-error.component.ts`
- Create: `frontend/src/app/shared/ui/form-error.component.spec.ts`

**Step 1: Write the failing test**

```ts
// form-error.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormErrorComponent } from './form-error.component';

describe('FormErrorComponent', () => {
  let fixture: ComponentFixture<FormErrorComponent>;
  let component: FormErrorComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormErrorComponent, ReactiveFormsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(FormErrorComponent);
    component = fixture.componentInstance;
  });

  it('shows nothing when control is valid', () => {
    const control = new FormControl('valid@email.com', [Validators.required, Validators.email]);
    control.markAsTouched();
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('shows required error when touched and empty', () => {
    const control = new FormControl('', [Validators.required]);
    control.markAsTouched();
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('required');
  });

  it('shows email error for invalid email format', () => {
    const control = new FormControl('not-email', [Validators.email]);
    control.markAsTouched();
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('valid email');
  });

  it('shows nothing when control is untouched (not submitted)', () => {
    const control = new FormControl('', [Validators.required]);
    // not touched
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
```

**Step 2: Run to verify FAIL**

```bash
cd frontend && npx ng test --watch=false --include="**/form-error*" 2>&1 | tail -10
```

**Step 3: Implement**

```ts
// form-error.component.ts
import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

const ERROR_MESSAGES: Record<string, string> = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  maxlength: 'Value is too long',
  minlength: 'Value is too short',
};

@Component({
  selector: 'app-form-error',
  template: `
    @if (control() && control()!.invalid && control()!.touched) {
      @for (key of errorKeys(); track key) {
        <p class="text-xs text-destructive mt-xs">{{ getMessage(key) }}</p>
      }
    }
  `,
})
export class FormErrorComponent {
  readonly control = input<AbstractControl | null>(null);

  protected errorKeys(): string[] {
    return Object.keys(this.control()?.errors ?? {});
  }

  protected getMessage(key: string): string {
    return ERROR_MESSAGES[key] ?? key;
  }
}
```

**Step 4: Run tests**

```bash
cd frontend && npx ng test --watch=false --include="**/form-error*" 2>&1 | tail -10
```

Expected: 4 tests PASS.

**Step 5: Commit**

```bash
git add frontend/src/app/shared/ui/form-error.component.ts \
        frontend/src/app/shared/ui/form-error.component.spec.ts
git commit -m "feat: add FormErrorComponent for reactive form validation messages"
```

---

## Task 7: Create register feature

**Files to create (all new):**
- `frontend/src/app/features/register/register.types.ts`
- `frontend/src/app/features/register/register.service.ts`
- `frontend/src/app/features/register/register.component.ts`
- `frontend/src/app/features/register/register.routes.ts`
- `frontend/src/app/features/register/register.component.spec.ts`
- `frontend/src/app/features/register/manifest.yaml`

**Step 1: Create types file**

```ts
// register.types.ts
export interface RegisterFormValue {
  name: string;
  email: string;
}
```

**Step 2: Write failing service test**

```ts
// register.component.spec.ts (service tests at top)
import { vi } from 'vitest';

vi.mock('../../shared/api/generated', () => ({
  createUser: vi.fn(),
}));

import { createUser } from '../../shared/api/generated';
import { TestBed } from '@angular/core/testing';
import { RegisterService } from './register.service';

describe('RegisterService', () => {
  let service: RegisterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RegisterService);
    vi.clearAllMocks();
  });

  it('sets loading during registration', async () => {
    (createUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 1, email: 'a@b.com', name: 'A', created_at: '' } });
    const promise = service.register({ email: 'a@b.com', name: 'A' });
    expect(service.loading()).toBe(true);
    await promise;
    expect(service.loading()).toBe(false);
  });

  it('sets success signal after registration', async () => {
    (createUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 1, email: 'a@b.com', name: 'A', created_at: '' } });
    await service.register({ email: 'a@b.com', name: 'A' });
    expect(service.success()).toBe(true);
  });

  it('sets error on failure', async () => {
    (createUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('409'));
    await service.register({ email: 'dup@b.com', name: 'A' });
    expect(service.error()).toBeTruthy();
    expect(service.success()).toBe(false);
  });
});
```

**Step 3: Create RegisterService**

```ts
// register.service.ts
import { Injectable, signal } from '@angular/core';
import { createUser } from '../../shared/api/generated';
import { RegisterFormValue } from './register.types';

@Injectable({ providedIn: 'root' })
export class RegisterService {
  readonly loading = signal(false);
  readonly success = signal(false);
  readonly error = signal<string | null>(null);

  async register(data: RegisterFormValue): Promise<void> {
    this.loading.set(true);
    this.success.set(false);
    this.error.set(null);
    try {
      await createUser({ body: { email: data.email, name: data.name } });
      this.success.set(true);
    } catch {
      this.error.set('Registration failed. The email may already be in use.');
    } finally {
      this.loading.set(false);
    }
  }
}
```

Note: Check generated `sdk.gen.ts` for the exact parameter shape of `createUser`. It may be `{ body: ... }` or `{ requestBody: ... }` depending on the generator version.

**Step 4: Write failing component test**

Append to `register.component.spec.ts`:

```ts
import { ComponentFixture } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RegisterComponent } from './register.component';
import { RegisterService } from './register.service';
import { InputComponent } from '../../shared/ui/input.component';
import { ButtonComponent } from '../../shared/ui/button.component';
import { FormErrorComponent } from '../../shared/ui/form-error.component';

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let component: RegisterComponent;
  let mockService: { register: ReturnType<typeof vi.fn>; loading: () => boolean; success: () => boolean; error: () => string | null };

  beforeEach(async () => {
    mockService = {
      register: vi.fn().mockResolvedValue(undefined),
      loading: vi.fn().mockReturnValue(false),
      success: vi.fn().mockReturnValue(false),
      error: vi.fn().mockReturnValue(null),
    };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent, ReactiveFormsModule, InputComponent, ButtonComponent, FormErrorComponent],
    })
      .overrideProvider(RegisterService, { useValue: mockService })
      .compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('submit button is disabled when form is invalid', () => {
    const btn = fixture.nativeElement.querySelector('[type="submit"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('calls service.register with form values on valid submit', async () => {
    component.form.setValue({ name: 'Alice', email: 'alice@example.com' });
    fixture.detectChanges();
    component.onSubmit();
    expect(mockService.register).toHaveBeenCalledWith({ name: 'Alice', email: 'alice@example.com' });
  });

  it('does not call service when form is invalid', () => {
    component.form.setValue({ name: '', email: 'not-email' });
    component.onSubmit();
    expect(mockService.register).not.toHaveBeenCalled();
  });
});
```

**Step 5: Create RegisterComponent**

```ts
// register.component.ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../shared/ui/button.component';
import { FormErrorComponent } from '../../shared/ui/form-error.component';
import { InputComponent } from '../../shared/ui/input.component';
import { RegisterService } from './register.service';

@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, InputComponent, ButtonComponent, FormErrorComponent],
  template: `
    <div class="max-w-sm mx-auto mt-lg p-lg">
      <h1 class="text-2xl font-bold text-foreground mb-lg">Create Account</h1>

      @if (service.success()) {
        <p class="text-sm text-primary">Account created! You can now sign in.</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <app-input
            formControlName="name"
            label="Full name"
            placeholder="Alice Smith"
          />
          <app-form-error [control]="form.controls.name" />

          <app-input
            formControlName="email"
            type="email"
            label="Email address"
            placeholder="alice@example.com"
          />
          <app-form-error [control]="form.controls.email" />

          @if (service.error(); as error) {
            <p class="text-sm text-destructive mb-sm">{{ error }}</p>
          }

          <app-button
            type="submit"
            [disabled]="form.invalid || service.loading()"
          >
            {{ service.loading() ? 'Creating account…' : 'Create account' }}
          </app-button>
        </form>
      }
    </div>
  `,
})
export class RegisterComponent {
  protected readonly service = inject(RegisterService);

  readonly form = new FormGroup({
    name: new FormControl('', {
      validators: [Validators.required, Validators.maxLength(100)],
      nonNullable: true,
    }),
    email: new FormControl('', {
      validators: [Validators.required, Validators.email],
      nonNullable: true,
    }),
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    this.service.register(this.form.getRawValue());
  }
}
```

**Step 6: Create routes file**

```ts
// register.routes.ts
import { Routes } from '@angular/router';

export const REGISTER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./register.component').then((m) => m.RegisterComponent),
  },
];
```

**Step 7: Create manifest.yaml**

```yaml
# frontend/src/app/features/register/manifest.yaml
name: register
tier: 1
description: User registration form — demonstrates Angular reactive forms pattern
version: 0.1.0
dependencies:
  internal: [user]
  external: []
api_endpoints:
  - POST /api/users
models: [RegisterFormValue]
events_emitted: []
events_consumed: []
```

**Step 8: Run component tests**

```bash
cd frontend && npx ng test --watch=false --include="**/register/**" 2>&1 | tail -20
```

Expected: 6 tests PASS (3 service + 3 component).

**Step 9: Commit**

```bash
git add frontend/src/app/features/register/
git commit -m "feat: add register feature with reactive forms pattern"
```

---

## Task 8: Add /register route to app.routes.ts

**Files:**
- Modify: `frontend/src/app/app.routes.ts`

**Step 1: Read current routes**

```bash
cat frontend/src/app/app.routes.ts
```

**Step 2: Add the route**

Add a public `/register` route (no `authGuard` — registration must be accessible without login):

```ts
{
  path: 'register',
  loadChildren: () =>
    import('./features/register/register.routes').then(
      (m) => m.REGISTER_ROUTES
    ),
},
```

Place it alongside the `auth` route (both are public).

**Step 3: Verify build**

```bash
cd frontend && npx ng build --configuration=development 2>&1 | tail -10
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add frontend/src/app/app.routes.ts
git commit -m "feat: add /register route to app routing"
```

---

## Task 9: Update frontend/AGENTS.md with new rules

**Files:**
- Modify: `frontend/AGENTS.md`

**Step 1: Read current AGENTS.md**

```bash
cat frontend/AGENTS.md | tail -50
```

**Step 2: Add rules section**

Append a new section titled `## API Client` and `## Forms` with these rules:

```markdown
## API Client

- NEVER call `HttpClient` directly for API endpoints defined in `shared/openapi.yaml`
- ALWAYS use the generated functions from `../../shared/api/generated` (e.g. `createUser`, `getUser`)
- Run `make generate` from the repo root after modifying `shared/openapi.yaml`
- Generated files live at `frontend/src/app/shared/api/generated/` — do NOT edit them manually
- The generated client is configured with the API base URL in `main.ts` — do not re-configure it in services

## Forms

- ALWAYS use `ReactiveFormsModule` and `FormGroup` for feature forms — never template-driven forms
- ALWAYS set `nonNullable: true` on `FormControl` — prevents null values in typed forms
- ALWAYS use `form.getRawValue()` to read values — not `form.value` (which marks disabled fields as undefined)
- Mark all form fields invalid by touching them before display: call `form.markAllAsTouched()` on failed submit
- ALWAYS pair `<app-input formControlName="...">` with `<app-form-error [control]="form.controls.field" />`
- DO NOT use `ngModel` in feature forms — only `formControlName` or `[formControl]`
- Form components: import `ReactiveFormsModule`, `InputComponent`, `ButtonComponent`, `FormErrorComponent`
```

**Step 3: Commit**

```bash
git add frontend/AGENTS.md
git commit -m "docs: add API client and forms rules to AGENTS.md"
```

---

## Task 10: Full verification

**Step 1: Run all backend tests**

```bash
PYTHONPATH=backend backend/.venv/bin/pytest backend/features -q
```

Expected: 6 passed.

**Step 2: Run all frontend tests**

```bash
cd frontend && npx ng test --watch=false 2>&1 | tail -20
```

Expected: All tests pass (register spec × 6, input spec × 3, form-error spec × 4, button spec × 4, plus any others that pass).

**Step 3: TypeScript strict build**

```bash
cd frontend && npx ng build --configuration=development 2>&1 | tail -10
```

Expected: 0 errors.

**Step 4: Architecture lint**

From worktree root:

```bash
python3 shared/scripts/lint-architecture.py 2>&1
```

Expected: No violations.

**Step 5: Manual smoke test (optional)**

```bash
# Terminal 1 — start backend (needs Docker for postgres)
docker-compose up db -d
cd backend && ../.venv/bin/uvicorn main:app --reload

# Terminal 2 — start frontend
cd frontend && npx ng serve
```

Navigate to `http://localhost:4200/register` — form should render, submitting valid data should POST to `/api/users`.

---

## Summary of commits

1. `fix: replace jasmine.createSpy with vi.fn() in existing specs`
2. `feat: install @hey-api/openapi-ts and generate API client`
3. `feat: configure generated API client base URL in main.ts`
4. `refactor: use generated getUser() in user-profile service`
5. `feat: add ControlValueAccessor to InputComponent for reactive forms`
6. `feat: add FormErrorComponent for reactive form validation messages`
7. `feat: add register feature with reactive forms pattern`
8. `feat: add /register route to app routing`
9. `docs: add API client and forms rules to AGENTS.md`
