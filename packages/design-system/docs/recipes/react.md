# React Recipe

React 18+ with TypeScript.

## Setup

Import the design system and fonts in your entry file:

```tsx
// main.tsx
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@aspect/design-system';
```

If using Vite, no additional config is needed -- CSS imports work out of the box.

## Components

### Button

```tsx
import { ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react';

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'default' | 'lg';

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = 'default', size = 'default', children, ...props }: ButtonProps) {
  return (
    <button className="btn" data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  );
}

type ButtonLinkProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
} & AnchorHTMLAttributes<HTMLAnchorElement>;

export function ButtonLink({
  variant = 'default',
  size = 'default',
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <a className="btn" data-variant={variant} data-size={size} {...props}>
      {children}
    </a>
  );
}
```

Usage:

```tsx
<Button variant="destructive" size="lg">Delete</Button>
<ButtonLink variant="outline" href="/settings">Settings</ButtonLink>
```

### Badge

```tsx
import { HTMLAttributes } from 'react';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

type BadgeProps = {
  variant?: BadgeVariant;
} & HTMLAttributes<HTMLSpanElement>;

export function Badge({ variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span className="badge" data-variant={variant} {...props}>
      {children}
    </span>
  );
}
```

### Card

```tsx
import { HTMLAttributes, ReactNode } from 'react';

type CardProps = {
  title?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export function Card({ title, children, ...props }: CardProps) {
  return (
    <div className="card" {...props}>
      {title && <h3 className="card-title">{title}</h3>}
      <div className="card-content">{children}</div>
    </div>
  );
}
```

### Input

```tsx
import { InputHTMLAttributes } from 'react';

type InputProps = {
  label?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function Input({ label, id, ...props }: InputProps) {
  return (
    <div className="input-wrapper">
      {label && (
        <label htmlFor={id} className="input-label">
          {label}
        </label>
      )}
      <input id={id} className="input-base" {...props} />
    </div>
  );
}
```

### FormError

```tsx
type FormErrorProps = {
  message?: string;
};

export function FormError({ message }: FormErrorProps) {
  if (!message) return null;
  return <p className="form-error">{message}</p>;
}
```

### Dialog

```tsx
import { ReactNode, useEffect } from 'react';

type DialogVariant = 'default' | 'destructive';

type DialogProps = {
  variant?: DialogVariant;
  title: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  onClose: () => void;
};

export function Dialog({ variant = 'default', title, footer, children, onClose }: DialogProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <>
      <div className="dialog-backdrop" aria-hidden="true" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="dialog-panel" data-variant={variant}>
        <div className="dialog-title">{title}</div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </>
  );
}
```

Usage:

```tsx
<Dialog
  variant="destructive"
  title={<h2>Delete account?</h2>}
  footer={
    <>
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={onDelete}>
        Delete
      </Button>
    </>
  }
  onClose={onClose}
>
  <p>This action cannot be undone.</p>
</Dialog>
```
