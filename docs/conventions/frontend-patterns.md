# Frontend Code Patterns Reference

Code examples for patterns described in `frontend/AGENTS.md`.

## Variant Pattern
```typescript
// Variants use data-* attributes, styled in packages/design-system/components.css
host: {
  '[attr.data-variant]': 'variant()',
  '[attr.data-size]': 'size()',
}
```
```css
/* In packages/design-system/components.css */
[appButton][data-variant="destructive"] { background-color: var(--color-destructive); }
```

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

## State Management (NgRx Signal Store)

```typescript
// Shared store (global singleton)
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState({ user: null, token: null }),
  withComputed(({ user }) => ({
    isAuthenticated: computed(() => user() !== null),
  })),
  withMethods((store) => ({
    logout(): void { patchState(store, { user: null, token: null }); },
  })),
);

// Feature store (component-scoped)
export const RegisterStore = signalStore(
  withState({ loading: false, success: false, error: null }),
  withMethods((store) => ({ ... })),
);
// Provided in component: @Component({ providers: [RegisterStore] })
```
