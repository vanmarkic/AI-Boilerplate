# Frontend — Angular 18+

## Architecture
Standalone components with Angular signals. Feature-sliced modules. No NgModules.

## Component Rules
1. All components are standalone (`standalone: true`).
2. Use `@if`/`@for` control flow, never `*ngIf`/`*ngFor`.
3. Use `inject()` function, never constructor injection.
4. Small components use inline templates. Extract to file if template > 30 lines.
5. Component selectors use `app-` prefix.

## State Management
6. Use `signal()` for local component state.
7. Use `computed()` for derived state.
8. Services hold shared state as signals. No BehaviorSubject. No NgRx.
9. Use `firstValueFrom()` to convert HttpClient observables to promises.

## File Organization
10. Each feature is a folder under `src/app/features/`.
11. Feature files: `component.ts`, `service.ts`, `types.ts`, `routes.ts`, `spec.ts`.
12. No barrel exports (index.ts). Use direct imports.
13. Maximum 250 lines per file.

## Imports
14. No barrel imports. Import directly: `from './user-profile/user-profile.service'`.
15. Shared UI components live in `src/app/shared/ui/`.
16. Auth utilities live in `src/app/shared/auth/`.
17. Generated API client is read-only: `src/app/shared/api/generated/`.

## Testing
18. Tests colocated as `feature-name.component.spec.ts`.
19. Use Angular Testing Library for component tests.
20. Mock services with `signal()` values in test providers.
21. Write failing test first, then implement.

## Routing
22. Each feature exports a `FEATURE_ROUTES` constant.
23. Top-level routes use `loadChildren()` for lazy loading.
24. Auth-protected routes use `canActivate: [authGuard]`.

## HTTP
25. All API calls go through generated client or services.
26. Base URL configured in `environment.ts`.
27. Auth token attached via `auth.interceptor.ts`.

## Styling
28. Component-scoped SCSS by default.
29. Global styles in `src/styles/global.scss` only for resets and variables.
30. No inline styles.
