# Angular Recipe

Angular 17+ with signals and standalone components.

## Setup

Add the design system and fonts to your `angular.json` styles array:

```json
{
  "architect": {
    "build": {
      "options": {
        "styles": [
          "node_modules/@fontsource-variable/inter/index.css",
          "node_modules/@fontsource-variable/jetbrains-mono/index.css",
          "node_modules/@aspect/design-system/index.css",
          "src/styles.css"
        ]
      }
    }
  }
}
```

This is preferred over CSS `@import` -- the Angular CLI handles bundling and deduplication.

## Components

### ButtonDirective

Headless directive on native `<button>` and `<a>` elements.

```typescript
import { Directive, input } from '@angular/core';

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'default' | 'lg';

@Directive({
  selector: 'button[appButton], a[appButton]',
  host: {
    'class': 'btn',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
  },
})
export class ButtonDirective {
  readonly variant = input<ButtonVariant>('default');
  readonly size = input<ButtonSize>('default');
}
```

Usage:

```html
<button appButton variant="destructive" size="lg">Delete</button>
<a appButton variant="outline" href="/settings">Settings</a>
```

### BadgeComponent

```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-badge',
  host: {
    'class': 'badge',
    '[attr.data-variant]': 'variant()',
  },
  template: `<ng-content />`,
})
export class BadgeComponent {
  readonly variant = input<'default' | 'secondary' | 'destructive' | 'outline'>('default');
}
```

Usage:

```html
<app-badge variant="destructive">Error</app-badge>
```

### CardComponent

```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  host: { class: 'card' },
  template: `
    @if (title()) {
      <h3 class="card-title">{{ title() }}</h3>
    }
    <div class="card-content">
      <ng-content />
    </div>
  `,
})
export class CardComponent {
  readonly title = input('');
}
```

Usage:

```html
<app-card title="Account">
  <p>Manage your account settings.</p>
</app-card>
```

### Input

Use the CSS classes directly in a template, or wrap in a `ControlValueAccessor` component:

```html
<div class="input-wrapper">
  <label for="email" class="input-label">Email</label>
  <input id="email" type="email" placeholder="you@example.com" class="input-base" />
</div>
```

For reactive forms, wrap in a component with `NG_VALUE_ACCESSOR`:

```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-input',
  host: { class: 'input-wrapper' },
  template: `
    @if (label()) {
      <label [for]="id()" class="input-label">{{ label() }}</label>
    }
    <input
      [id]="id()"
      [type]="type()"
      [placeholder]="placeholder()"
      class="input-base"
    />
  `,
})
export class InputComponent {
  readonly id = input('');
  readonly label = input('');
  readonly type = input<'text' | 'email' | 'password'>('text');
  readonly placeholder = input('');
}
```

### FormError

Use the `.form-error` class on a `<p>` element:

```html
<p class="form-error">This field is required</p>
```

Or wrap in a component that reads `AbstractControl` errors:

```typescript
import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

const ERROR_MESSAGES: Record<string, string> = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
};

@Component({
  selector: 'app-form-error',
  template: `
    @if (control() && control()!.invalid && control()!.touched) {
      @for (key of errorKeys(); track key) {
        <p class="form-error">{{ getMessage(key) }}</p>
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

### DialogPanel

```typescript
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-dialog-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown.escape)': 'closed.emit()',
  },
  template: `
    <div class="dialog-backdrop" aria-hidden="true" (click)="closed.emit()"></div>
    <div role="dialog" aria-modal="true" class="dialog-panel" [attr.data-variant]="variant()">
      <div class="dialog-title">
        <ng-content select="[dialogTitle]" />
      </div>
      <div class="dialog-body">
        <ng-content />
      </div>
      <div class="dialog-footer">
        <ng-content select="[dialogFooter]" />
      </div>
    </div>
  `,
})
export class DialogPanelComponent {
  readonly variant = input<'default' | 'destructive'>('default');
  readonly closed = output();
}
```

Usage:

```html
<app-dialog-panel variant="destructive" (closed)="onClose()">
  <h2 dialogTitle>Delete account?</h2>
  <p>This action cannot be undone.</p>
  <div dialogFooter>
    <button appButton variant="outline" (click)="onClose()">Cancel</button>
    <button appButton variant="destructive" (click)="onDelete()">Delete</button>
  </div>
</app-dialog-panel>
```
