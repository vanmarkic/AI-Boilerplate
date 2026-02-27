# API Client Codegen + Angular Reactive Forms

**Date:** 2026-02-27
**Status:** Approved

## Problem

Two gaps in the boilerplate's LLM-agent usability:
1. `make generate` script exists but packages aren't installed and nothing uses the generated client — services call `HttpClient` directly, so there's no example of the intended pattern
2. No Angular reactive forms pattern — `InputComponent` only works with `ngModel`, and no feature demonstrates typed `FormGroup` + validation

## Solution

### 1. API Client Codegen

- Install `@hey-api/openapi-ts` + `@hey-api/client-fetch` in `frontend/package.json`
- Run `make generate` → produces typed functions at `frontend/src/app/shared/api/generated/`
- Update `user-profile.service.ts` to use `getUser()` from generated client (canonical before/after)
- New `register.service.ts` uses `createUser()` from generated client
- Add AGENTS.md rule: never call `HttpClient` directly; use generated functions; run `make generate` after changing `shared/openapi.yaml`

### 2. InputComponent — ControlValueAccessor

- Implement `ControlValueAccessor` on existing `InputComponent` (~25 lines added)
- Registers as `NG_VALUE_ACCESSOR` provider
- Fully backwards-compatible with existing `[(ngModel)]` usage
- Enables `formControlName` binding in reactive forms

### 3. New UI Primitive — FormErrorComponent

- `frontend/src/app/shared/ui/form-error.component.ts`
- Accepts a `FormControl` input, displays validation error messages
- Standard error display: required, email format, maxLength
- Used as: `<app-form-error [control]="form.controls.email" />`

### 4. Register Feature

New feature at `frontend/src/app/features/register/`:

| File | Purpose |
|------|---------|
| `register.component.ts` | Reactive form with name + email fields, OnPush |
| `register.service.ts` | Calls `createUser()` from generated API client |
| `register.types.ts` | `RegisterFormValue` interface |
| `register.routes.ts` | Exports `REGISTER_ROUTES` |
| `register.component.spec.ts` | Validates form rules + submit behavior |
| `manifest.yaml` | tier: 1, depends on: user feature |

Route: `/register` added to `app.routes.ts` (public, no auth guard)

Form fields:
```ts
form = new FormGroup({
  name:  new FormControl('', { validators: [Validators.required, Validators.maxLength(100)], nonNullable: true }),
  email: new FormControl('', { validators: [Validators.required, Validators.email], nonNullable: true }),
});
```

Submission: `form.getRawValue()` → `service.register()` → `createUser()` from generated client

### 5. AGENTS.md Rules Added

~8 new frontend rules:
- Always `nonNullable: true` on `FormControl`
- Use `form.getRawValue()` not `form.value`
- Never use template-driven forms for feature forms
- Always pair `<app-input formControlName>` with `<app-form-error>`
- Never call `HttpClient` directly — use generated client functions
- Run `make generate` after changing `shared/openapi.yaml`

## Files Changed

| File | Change |
|------|--------|
| `frontend/package.json` | Add `@hey-api/openapi-ts`, `@hey-api/client-fetch` to devDependencies |
| `frontend/src/app/shared/ui/input.component.ts` | Add ControlValueAccessor |
| `frontend/src/app/shared/ui/form-error.component.ts` | New primitive |
| `frontend/src/app/shared/ui/index.ts` | Export form-error |
| `frontend/src/app/features/user-profile/user-profile.service.ts` | Use generated `getUser()` |
| `frontend/src/app/features/register/*` | New feature (6 files) |
| `frontend/src/app/app.routes.ts` | Add `/register` route |
| `frontend/AGENTS.md` | Add form + codegen rules |

## Verification

1. `cd frontend && npm install` — installs codegen packages
2. `make generate` — generates `shared/api/generated/` without errors
3. TypeScript compiles: `ng build --configuration=development`
4. `make test-frontend` — register spec tests pass
5. `ng serve` → navigate to `/register` → fill form → submit → check network tab for `POST /api/users`
6. Architecture linter passes: `make lint-arch`
