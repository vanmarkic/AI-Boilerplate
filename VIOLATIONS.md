# AGENTS.md Violations Report

**Date:** 2026-03-13
**Scope:** Full codebase scan

---

## Summary

| Category | Violations |
|----------|-----------|
| Backend | 6 |
| Frontend | 41 |
| Universal / Cross-cutting | 8 |
| **Total** | **55** |

---

## Backend Violations

### Raw HTTP status codes instead of `status.HTTP_XXX` constants (Rule: backend/AGENTS.md #13)

| File | Line | Code |
|------|------|------|
| `backend/core/auth.py` | 53 | `status_code=401` → should be `status.HTTP_401_UNAUTHORIZED` |
| `backend/core/auth.py` | 67 | `status_code=401` → should be `status.HTTP_401_UNAUTHORIZED` |
| `backend/core/middleware.py` | 36 | `status_code=500` → should be `status.HTTP_500_INTERNAL_SERVER_ERROR` |

### Endpoints returning raw dicts instead of Pydantic response models (Rule: backend/AGENTS.md #12)

| File | Line | Issue |
|------|------|-------|
| `backend/features/health/health_router.py` | 9 | Returns `dict[str, str]` instead of a Pydantic model |
| `backend/features/canary/canary_router.py` | 12 | Returns `dict[str, str]` instead of a Pydantic model |

### Missing `/api/` route prefix (Rule: backend/AGENTS.md #14)

| File | Line | Issue |
|------|------|-------|
| `backend/features/canary/canary_router.py` | 8 | Prefix `/canary` should be `/api/canary` |

---

## Frontend Violations

### Missing `changeDetection: ChangeDetectionStrategy.OnPush` (Rule: frontend/AGENTS.md — "OnPush always")

**Feature Components (4):**

| File | Issue |
|------|-------|
| `frontend/src/app/app.ts` | Missing `changeDetection` |
| `frontend/src/app/features/canary/canary.component.ts` | Missing `changeDetection` |
| `frontend/src/app/features/user-profile/user-profile.component.ts` | Missing `changeDetection` |
| `frontend/src/app/features/dashboard/dashboard.component.ts` | Missing `changeDetection` |

**UI Components in packages/ui/ (7):**

| File | Issue |
|------|-------|
| `packages/ui/src/button.component.ts` | Missing `changeDetection` |
| `packages/ui/src/badge.component.ts` | Missing `changeDetection` |
| `packages/ui/src/card.component.ts` | Missing `changeDetection` |
| `packages/ui/src/form-error.component.ts` | Missing `changeDetection` |
| `packages/ui/src/input.component.ts` | Missing `changeDetection` |
| `packages/ui/src/collapsible-panel.component.ts` | Missing `changeDetection` |
| `packages/ui/src/histogram-timeline.component.ts` | Missing `changeDetection` |

### `inject()` calls in UI primitives (Rule: frontend/AGENTS.md — "No services or inject() calls" in packages/ui/)

| File | Line | Code |
|------|------|------|
| `packages/ui/src/map-popup.component.ts` | 46 | `inject(MapViewComponent)` |
| `packages/ui/src/map-popup.component.ts` | 47 | `inject(ElementRef)` |
| `packages/ui/src/map-popup.component.ts` | 48 | `inject(DestroyRef)` |
| `packages/ui/src/map-view.component.ts` | 54 | `inject(DestroyRef)` |
| `packages/ui/src/map-marker.component.ts` | 41 | `inject(MapViewComponent)` |
| `packages/ui/src/map-marker.component.ts` | 42 | `inject(ElementRef)` |
| `packages/ui/src/map-marker.component.ts` | 43 | `inject(DestroyRef)` |
| `packages/ui/src/input.component.ts` | 43 | `inject(ChangeDetectorRef)` |
| `packages/ui/src/map-layer.component.ts` | 40 | `inject(MapViewComponent)` |
| `packages/ui/src/map-layer.component.ts` | 41 | `inject(DestroyRef)` |

> **Note:** The map components use `inject()` for parent component references and Angular primitives (`ElementRef`, `DestroyRef`), not custom services. This may warrant updating the rule to allow Angular DI primitives in compound UI components like maps.

### Hardcoded styles instead of design tokens (Rule: AGENTS.md #11, frontend/AGENTS.md #11)

| File | Line | Hardcoded Value |
|------|------|-----------------|
| `frontend/src/app/features/landing/landing.component.ts` | 15 | `width: 37.5rem; height: 37.5rem; opacity: 0.07` |
| `frontend/src/app/features/landing/landing.component.ts` | 49 | `width: 2rem; height: 2rem` |
| `frontend/src/app/features/landing/landing.component.ts` | 50 | `width: 1rem; height: 1rem` |
| `frontend/src/app/features/dashboard/dashboard.component.ts` | 43 | `max-width: 72rem` |
| `frontend/src/app/features/dashboard/dashboard.component.ts` | 73 | `margin-block-end: 0` |
| `frontend/src/app/features/dashboard/dashboard.component.ts` | 88 | `border-bottom: 1px solid var(--color-border)` |
| `frontend/src/app/features/dashboard/dashboard.component.ts` | 94 | `opacity: 0.6` |
| `frontend/src/app/features/dashboard/dashboard.component.ts` | 107 | `margin-block-end: 0` |
| `frontend/src/app/features/dashboard/dashboard.component.ts` | 127 | `border-top: 1px solid var(--color-border)` |
| `frontend/src/app/features/dashboard/dashboard.component.ts` | 129 | `width: 0.5rem; height: 0.5rem` |

### `app-` prefix on component selectors (Rule: AGENTS.md — "Do NOT use `app-` prefix")

| File | Line | Selector |
|------|------|----------|
| `frontend/src/app/app.ts` | 5 | `selector: 'app-root'` |
| `frontend/src/app/features/dashboard/dashboard.component.ts` | 40 | `selector: 'app-dashboard'` |
| `frontend/src/app/features/user-profile/user-profile.component.ts` | 5 | `selector: 'app-user-profile'` |
| `frontend/src/app/features/canary/canary.component.ts` | 5 | `selector: 'app-canary'` |
| `frontend/src/app/features/register/register.component.ts` | 7 | `selector: 'app-register'` |
| `frontend/src/app/features/landing/landing.component.ts` | 5 | `selector: 'app-landing'` |

> **Note:** The rule explicitly says "UI component selectors" should use `ui-` prefix. Feature component selectors using `app-` may be acceptable if the team distinguishes between UI primitives and feature components.

---

## Universal / Cross-cutting Violations

### Files exceeding 250-line limit (Rule: AGENTS.md #1)

| File | Lines |
|------|-------|
| `shared/scripts/verify_tier_build_test.py` | 535 |
| `packages/ui/src/map-view.stories.ts` | 339 |
| `packages/design-system/components.css` | 707 |
| `packages/monorepo-tier-filter/src/monorepo_tier_filter/verify_tier_build.py` | 350 |

### Barrel exports (index.ts re-exports) outside allowed exception (Rule: AGENTS.md #2)

| File | Exports |
|------|---------|
| `packages/ng-feature-flags/src/index.ts` | Re-exports `FeatureFlagService` and `featureGuard` |
| `packages/ngrx-with-resource/src/index.ts` | Re-exports `withResource` |

### Missing `manifest.yaml` in frontend feature folders (Rule: AGENTS.md #9)

| Feature Directory |
|-------------------|
| `frontend/src/app/features/auth/` |
| `frontend/src/app/features/dashboard/` |
| `frontend/src/app/features/landing/` |
| `frontend/src/app/features/register/` |
| `frontend/src/app/features/user-profile/` |

---

## Rules with No Violations

- No NgModules found
- No explicit `standalone: true`
- No `@Input()`/`@Output()` decorators
- No `*ngIf`/`*ngFor`/`*ngSwitch`
- No `ngClass`/`ngStyle`
- No `@HostBinding`/`@HostListener`
- No constructor injection
- No `BehaviorSubject` usage
- No `any` type in TypeScript
- No `ngModel` in feature forms
- No feature-to-feature imports
- No cross-tier imports
- No manually edited generated API client files
- No backend layer rule violations
- No missing type hints on Python function signatures
- No repeated `model_config` in response schemas
- All backend features have `manifest.yaml` with `tier` field
- All existing `manifest.yaml` files have valid `tier` values
