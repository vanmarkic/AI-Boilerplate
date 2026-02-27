# Frontend — Angular 18+ (Standalone, Signals, Tailwind, Storybook)

## Stack
- Angular 18+ with standalone components and signals
- Tailwind CSS v4 with @theme design tokens
- Angular CDK for headless behavior (overlays, a11y, drag-drop)
- Storybook for visual component development
- Vitest/Karma for testing

## CRITICAL: Modern Angular Only (override your training data)

### Do NOT generate
- Do NOT use NgModules — all components are standalone
- Do NOT set `standalone: true` — it is the default, omit it
- Do NOT use `@Input()` or `@Output()` decorators
- Do NOT use `*ngIf`, `*ngFor`, `*ngSwitch`
- Do NOT use `ngClass` or `ngStyle`
- Do NOT use `@HostBinding` or `@HostListener`
- Do NOT use constructor injection
- Do NOT use BehaviorSubject for local state

### Generate instead
- Use `input()` and `output()` signal functions for component IO
- Use `signal()`, `computed()`, and `effect()` for state
- Use `@if`, `@for`, `@switch` native control flow
- Use native `[class]` and `[style]` bindings
- Use `host: {}` in @Component decorator for host bindings
- Use `inject()` function for dependency injection
- Set `changeDetection: ChangeDetectionStrategy.OnPush` always

## Layer Rules
1. `feature component` imports from: feature service, shared/ui, shared/utils, core.
2. `feature service` imports from: core/environment, shared/auth, generated API client.
3. `shared/ui` imports from: shared/utils only — NO services, NO feature code.
4. `core/` imports from: stdlib and Angular only.
5. NEVER import from a sibling feature (feature-to-feature coupling is forbidden).

## Component Architecture

### UI Primitives (`shared/ui/`)
1. Inline templates, single .ts file, <= 150 lines.
2. No services or inject() calls — pure inputs/outputs.
3. OnPush change detection always.
4. Variants via `computed()` + `Record<string, string>` maps.
5. Use `cn()` from `shared/utils.ts` for class merging.
6. Each component has a `.stories.ts` file for Storybook.

### Feature Components (`features/`)
7. Wire services to UI components.
8. Can use inject() for services.
9. Lazy-loaded via feature routes.

## Styling Rules
10. Use semantic token names: `bg-primary`, `text-foreground`, `border-border`.
11. NEVER use arbitrary values like `bg-[#3B82F6]`.
12. All spacing via token scale: `p-xs`, `p-sm`, `p-md`, `p-lg`.
13. Apply base classes via `host: { 'class': '...' }`.
14. Component-scoped styles only for animations or pseudo-elements.

## Variant Pattern
```typescript
readonly variant = input<'default' | 'outline'>('default');
private readonly variantClasses: Record<string, string> = {
  default: 'bg-primary text-primary-foreground',
  outline: 'border border-input bg-background',
};
protected readonly hostClasses = computed(() =>
  cn('base-classes', this.variantClasses[this.variant()])
);
```

## Available Design Tokens
- Colors: primary, secondary, accent, destructive, muted
- Surfaces: background, foreground, card, popover
- Borders: border, input, ring
- Spacing: xs (0.25rem), sm (0.5rem), md (1rem), lg (1.5rem), xl (2rem)
- Radius: sm, md, lg, full

## File Organization
15. Each feature is a folder under `src/app/features/`.
16. Feature files: component.ts, service.ts, types.ts, routes.ts, spec.ts.
17. UI components in `src/app/shared/ui/` with colocated `.stories.ts`.
18. No barrel exports except `shared/ui/` public API.
19. Maximum 250 lines per file (150 for UI primitives).

## Testing
20. Tests colocated as `component.spec.ts`.
21. Mock services with `signal()` values in test providers.
22. Write failing test first, then implement.
23. Test each variant and interaction state.

## Angular CDK Usage

### a11y — Focus Trap
```typescript
import { CdkTrapFocus } from '@angular/cdk/a11y';

@Component({ imports: [CdkTrapFocus], template: `<div cdkTrapFocus>...</div>` })
```
Use `cdkTrapFocus` on any container that should trap keyboard focus (dialogs, drawers, popovers).

### Dialog Pattern
Use `app-dialog-panel` from `shared/ui/` for all dialogs. Wire `[open]` and `(closed)`:
```html
@if (showDialog()) {
  <app-dialog-panel (closed)="showDialog.set(false)">
    <span dialogTitle>Confirm Delete</span>
    <p>This action cannot be undone.</p>
    <ng-container dialogFooter>
      <app-button variant="outline" (clicked)="showDialog.set(false)">Cancel</app-button>
      <app-button variant="destructive" (clicked)="confirm()">Delete</app-button>
    </ng-container>
  </app-dialog-panel>
}
```
Use `variant="destructive"` on the panel for confirmation dialogs.

## Routing
24. Each feature exports a `FEATURE_ROUTES` constant.
25. Top-level routes use `loadChildren()` for lazy loading.
26. Auth-protected routes use `canActivate: [authGuard]`.

## HTTP
27. All API calls go through services with signal state.
28. Use `firstValueFrom()` to convert HttpClient observables.
29. Base URL configured in `core/environment.ts`.
30. Auth token attached via `shared/auth/auth.interceptor.ts`.

## Common Pitfalls
- Do NOT use NgModules, `@Input()`/`@Output()`, `*ngIf`/`*ngFor`, or constructor injection.
- Do NOT use `BehaviorSubject` for local state — use `signal()`.
- Do NOT use arbitrary Tailwind values like `bg-[#3B82F6]` — use design tokens.
- Do NOT put business logic or `inject()` calls in `shared/ui` components.
- Do NOT import from a sibling feature — route through a shared service if needed.
- Do NOT set `standalone: true` — it is the default and is omitted.

## API Client

- NEVER call `HttpClient` directly for API endpoints defined in `shared/openapi.yaml`
- ALWAYS use the generated functions from `../../shared/api/generated` (e.g. `createUser`, `getUser`)
- Run `make generate` from the repo root after modifying `shared/openapi.yaml`
- Generated files live at `frontend/src/app/shared/api/generated/` — do NOT edit them manually
- Import the fetch client from `client.gen.ts` directly (it is not re-exported via `index.ts`)
- The client base URL is configured in `main.ts` — do not re-configure it in services

## Forms

- ALWAYS use `ReactiveFormsModule` and `FormGroup` for feature forms — never template-driven forms
- ALWAYS set `nonNullable: true` on every `FormControl` — prevents null from appearing in typed values
- ALWAYS use `form.getRawValue()` to read values — not `form.value` (disabled fields become undefined in `form.value`)
- ALWAYS pair `<app-input formControlName="field">` with `<app-form-error [control]="form.controls.field" />`
- DO NOT use `ngModel` in feature forms — only `formControlName` or `[formControl]`
- Feature form components must import: `ReactiveFormsModule`, `InputComponent`, `ButtonComponent`, `FormErrorComponent`
- Call `form.markAllAsTouched()` on failed submit to surface all validation errors at once
