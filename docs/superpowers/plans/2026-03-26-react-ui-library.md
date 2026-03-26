# React UI Library (`@aspect/react-ui`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `@aspect/react-ui` with the 13 components that `apps/main/frontend` uses from `@aspect/ui`, enabling the React migration of the main app.

**Architecture:** Pure React 19 functional components applying the same CSS classes and `data-*` attributes as `@aspect/ui`. The `@aspect/design-system` CSS is consumed unchanged — no CSS in this package. `DataTable` wraps TanStack Table v8. `CollapsiblePanel` uses native `<details>`. `DialogPanel` uses the same div-based markup as Angular (backdrop + panel divs) for CSS compatibility. Built with Vite library mode, tested with Vitest + React Testing Library.

**Tech Stack:** React 19, TypeScript 5.9, Vite (library mode), Vitest, @testing-library/react, TanStack Table v8

**Spec:** `docs/plans/react-ui-migration.md`

---

## Component Mapping

| Angular Component | React Component | Complexity | Notes |
|---|---|---|---|
| `ButtonDirective` | `Button` | Trivial | CSS class + data-* attrs |
| `BadgeComponent` | `Badge` | Trivial | CSS class + data-variant |
| `InputComponent` | `Input` | Light | Controlled component, label, useId |
| `FormErrorComponent` | `FormError` | Light | Error key → message mapping |
| `DialogPanelComponent` | `DialogPanel` | Moderate | Escape + backdrop click handlers |
| `CollapsiblePanelComponent` | `CollapsiblePanel` | Trivial | Native `<details>` element |
| `PageLayoutComponent` | `PageLayout` | Trivial | Header/main/footer slots |
| `PageHeaderComponent` | `PageHeader` | Trivial | Title + subtitle + actions |
| `TabNavComponent` | `TabNav` | Trivial | Nav container |
| `TabLinkDirective` | `TabLink` | Trivial | Anchor with active class |
| `HistogramTimelineComponent` | `HistogramTimeline` | Light | CSS variable normalization |
| `DataTableComponent` | `DataTable` | Moderate | TanStack Table v8 wrapper |
| `DataTableColumnComponent` | `DataTableColumn` (type) | — | Column definition via props, not child component |

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `packages/react-ui/package.json` | Create | Manifest: React 19 peer dep, TanStack Table dep |
| `packages/react-ui/tsconfig.json` | Create | Strict TS, JSX react-jsx, ESM |
| `packages/react-ui/vite.config.ts` | Create | Library mode build, React plugin, dts |
| `packages/react-ui/vitest.config.ts` | Create | jsdom env, globals, setup file |
| `packages/react-ui/src/test-setup.ts` | Create | jest-dom matchers |
| `packages/react-ui/src/index.ts` | Create | Public barrel exports |
| `packages/react-ui/src/button.tsx` | Create | Button component |
| `packages/react-ui/src/button.spec.tsx` | Create | Button tests |
| `packages/react-ui/src/badge.tsx` | Create | Badge component |
| `packages/react-ui/src/badge.spec.tsx` | Create | Badge tests |
| `packages/react-ui/src/input.tsx` | Create | Input with label + controlled pattern |
| `packages/react-ui/src/input.spec.tsx` | Create | Input tests |
| `packages/react-ui/src/form-error.tsx` | Create | Validation error display |
| `packages/react-ui/src/form-error.spec.tsx` | Create | FormError tests |
| `packages/react-ui/src/dialog-panel.tsx` | Create | Modal dialog (backdrop + panel divs) |
| `packages/react-ui/src/dialog-panel.spec.tsx` | Create | DialogPanel tests |
| `packages/react-ui/src/collapsible-panel.tsx` | Create | Accordion (native `<details>`) |
| `packages/react-ui/src/collapsible-panel.spec.tsx` | Create | CollapsiblePanel tests |
| `packages/react-ui/src/page-layout.tsx` | Create | Header/main/footer layout shell |
| `packages/react-ui/src/page-layout.spec.tsx` | Create | PageLayout tests |
| `packages/react-ui/src/page-header.tsx` | Create | Page title + subtitle + actions |
| `packages/react-ui/src/page-header.spec.tsx` | Create | PageHeader tests |
| `packages/react-ui/src/tab-nav.tsx` | Create | TabNav container + TabLink anchor |
| `packages/react-ui/src/tab-nav.spec.tsx` | Create | TabNav tests |
| `packages/react-ui/src/histogram-timeline.tsx` | Create | Bar chart with CSS variables |
| `packages/react-ui/src/histogram-timeline.spec.tsx` | Create | HistogramTimeline tests |
| `packages/react-ui/src/data-table.tsx` | Create | Data table (TanStack Table v8) |
| `packages/react-ui/src/data-table.spec.tsx` | Create | DataTable tests |
| `Makefile` | Modify | Add `test-react-ui` to validate chain |

---

### Task 1: Package Scaffold

**Files:**
- Create: `packages/react-ui/package.json`
- Create: `packages/react-ui/tsconfig.json`
- Create: `packages/react-ui/vite.config.ts`
- Create: `packages/react-ui/vitest.config.ts`
- Create: `packages/react-ui/src/test-setup.ts`
- Create: `packages/react-ui/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@aspect/react-ui",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ci": "vitest run --reporter=default"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "dependencies": {
    "@tanstack/react-table": "^8.20.6"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.1.4",
    "@types/react-dom": "^19.1.5",
    "@vitejs/plugin-react": "^4.5.2",
    "jsdom": "^26.1.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "typescript": "^5.9.2",
    "vite": "^6.3.5",
    "vite-plugin-dts": "^4.5.4",
    "vitest": "^4.0.8"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationDir": "dist",
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [react(), dts({ tsconfigPath: './tsconfig.json' })],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
});
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});
```

- [ ] **Step 5: Create src/test-setup.ts**

```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 6: Create empty src/index.ts**

```typescript
// @aspect/react-ui — public API
// Components are exported as they are implemented.
```

- [ ] **Step 7: Install dependencies and verify**

Run: `cd packages/react-ui && npm install`
Run: `cd packages/react-ui && npx vitest run`

Expected: 0 tests found, no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/react-ui/
git commit -m "feat(react-ui): scaffold package with Vite, Vitest, React 19

Empty @aspect/react-ui package ready for component development.
Vite library mode build, Vitest + RTL test setup."
```

---

### Task 2: Button + Badge

**Files:**
- Create: `packages/react-ui/src/button.tsx`
- Create: `packages/react-ui/src/button.spec.tsx`
- Create: `packages/react-ui/src/badge.tsx`
- Create: `packages/react-ui/src/badge.spec.tsx`
- Modify: `packages/react-ui/src/index.ts`

- [ ] **Step 1: Write failing tests**

button.spec.tsx:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('renders with default variant and size', () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole('button', { name: 'Click' });
    expect(btn).toHaveClass('btn');
    expect(btn).toHaveAttribute('data-variant', 'default');
    expect(btn).toHaveAttribute('data-size', 'default');
  });

  it('applies custom variant and size', () => {
    render(<Button variant="destructive" size="lg">Delete</Button>);
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn).toHaveAttribute('data-variant', 'destructive');
    expect(btn).toHaveAttribute('data-size', 'lg');
  });

  it('forwards onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders as disabled', () => {
    render(<Button disabled>Nope</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

badge.spec.tsx:
```tsx
import { render, screen } from '@testing-library/react';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>New</Badge>);
    const badge = screen.getByText('New');
    expect(badge).toHaveClass('badge');
    expect(badge).toHaveAttribute('data-variant', 'default');
  });

  it('applies custom variant', () => {
    render(<Badge variant="destructive">Error</Badge>);
    expect(screen.getByText('Error')).toHaveAttribute('data-variant', 'destructive');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd packages/react-ui && npx vitest run`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write implementations**

button.tsx:
```tsx
import { type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'default' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

export function Button({
  variant = 'default',
  size = 'default',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={className ? `btn ${className}` : 'btn'}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  );
}
```

badge.tsx:
```tsx
import { type HTMLAttributes, type ReactNode } from 'react';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children?: ReactNode;
}

export function Badge({
  variant = 'default',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={className ? `badge ${className}` : 'badge'}
      data-variant={variant}
      {...props}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Export from index.ts**

```typescript
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './button';
export { Badge, type BadgeProps, type BadgeVariant } from './badge';
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `cd packages/react-ui && npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/react-ui/src/button.tsx packages/react-ui/src/button.spec.tsx \
  packages/react-ui/src/badge.tsx packages/react-ui/src/badge.spec.tsx \
  packages/react-ui/src/index.ts
git commit -m "feat(react-ui): add Button and Badge components

CSS-driven components using design system classes and data-* attributes.
Button supports variant/size/disabled. Badge supports variant."
```

---

### Task 3: Input + FormError

**Files:**
- Create: `packages/react-ui/src/input.tsx`
- Create: `packages/react-ui/src/input.spec.tsx`
- Create: `packages/react-ui/src/form-error.tsx`
- Create: `packages/react-ui/src/form-error.spec.tsx`
- Modify: `packages/react-ui/src/index.ts`

- [ ] **Step 1: Write failing tests**

input.spec.tsx:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './input';

describe('Input', () => {
  it('renders with label linked to input', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toHaveClass('input-base');
  });

  it('renders without label', () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText('Type here')).toHaveClass('input-base');
  });

  it('fires onChange and onValueChange', async () => {
    const onValueChange = vi.fn();
    const onChange = vi.fn();
    render(<Input label="Name" onChange={onChange} onValueChange={onValueChange} />);
    await userEvent.type(screen.getByLabelText('Name'), 'hi');
    expect(onChange).toHaveBeenCalled();
    expect(onValueChange).toHaveBeenLastCalledWith('hi');
  });

  it('renders as disabled', () => {
    render(<Input label="Locked" disabled />);
    expect(screen.getByLabelText('Locked')).toBeDisabled();
  });
});
```

form-error.spec.tsx:
```tsx
import { render, screen } from '@testing-library/react';
import { FormError } from './form-error';

describe('FormError', () => {
  it('renders nothing when not touched', () => {
    const { container } = render(
      <FormError errors={{ required: true }} touched={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no errors', () => {
    const { container } = render(<FormError errors={{}} touched />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows mapped message for "required"', () => {
    render(<FormError errors={{ required: true }} touched />);
    expect(screen.getByText('This field is required')).toHaveClass(
      'form-error',
    );
  });

  it('shows mapped message for "email"', () => {
    render(<FormError errors={{ email: true }} touched />);
    expect(screen.getByText('Please enter a valid email address')).toHaveClass(
      'form-error',
    );
  });

  it('falls back to key name for unknown errors', () => {
    render(<FormError errors={{ customRule: true }} touched />);
    expect(screen.getByText('customRule')).toHaveClass('form-error');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd packages/react-ui && npx vitest run`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write implementations**

input.tsx:
```tsx
import { type ChangeEvent, type InputHTMLAttributes, useId } from 'react';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  onValueChange?: (value: string) => void;
}

export function Input({
  label,
  onValueChange,
  onChange,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    onValueChange?.(e.target.value);
  };

  return (
    <div className="input-wrapper">
      {label && (
        <label className="input-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className="input-base"
        onChange={handleChange}
        {...props}
      />
    </div>
  );
}
```

form-error.tsx:
```tsx
const ERROR_MESSAGES: Record<string, string> = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  maxlength: 'Value is too long',
  minlength: 'Value is too short',
};

export interface FormErrorProps {
  errors?: Record<string, unknown>;
  touched?: boolean;
}

export function FormError({ errors, touched }: FormErrorProps) {
  if (!touched || !errors) return null;
  const keys = Object.keys(errors);
  if (keys.length === 0) return null;

  return (
    <div role="alert">
      {keys.map((key) => (
        <p key={key} className="form-error">
          {ERROR_MESSAGES[key] ?? key}
        </p>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Export from index.ts**

Append to index.ts:
```typescript
export { Input, type InputProps } from './input';
export { FormError, type FormErrorProps } from './form-error';
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `cd packages/react-ui && npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/react-ui/src/input.tsx packages/react-ui/src/input.spec.tsx \
  packages/react-ui/src/form-error.tsx packages/react-ui/src/form-error.spec.tsx \
  packages/react-ui/src/index.ts
git commit -m "feat(react-ui): add Input and FormError components

Input: controlled component with label, onValueChange callback.
FormError: displays validation errors when touched, maps known error keys."
```

---

### Task 4: DialogPanel + CollapsiblePanel

**Files:**
- Create: `packages/react-ui/src/dialog-panel.tsx`
- Create: `packages/react-ui/src/dialog-panel.spec.tsx`
- Create: `packages/react-ui/src/collapsible-panel.tsx`
- Create: `packages/react-ui/src/collapsible-panel.spec.tsx`
- Modify: `packages/react-ui/src/index.ts`

- [ ] **Step 1: Write failing tests**

dialog-panel.spec.tsx:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DialogPanel } from './dialog-panel';

describe('DialogPanel', () => {
  it('renders title, body, and footer', () => {
    render(
      <DialogPanel title={<span>Title</span>} footer={<button>OK</button>}>
        Body text
      </DialogPanel>,
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Body text')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it('applies variant', () => {
    const { container } = render(
      <DialogPanel variant="destructive">X</DialogPanel>,
    );
    expect(container.querySelector('[role="dialog"]')).toHaveAttribute(
      'data-variant',
      'destructive',
    );
  });

  it('fires onClose on backdrop click', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <DialogPanel onClose={onClose}>X</DialogPanel>,
    );
    await userEvent.click(container.querySelector('.dialog-backdrop')!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('fires onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<DialogPanel onClose={onClose}>X</DialogPanel>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

collapsible-panel.spec.tsx:
```tsx
import { render, screen } from '@testing-library/react';
import { CollapsiblePanel } from './collapsible-panel';

describe('CollapsiblePanel', () => {
  it('renders collapsed by default', () => {
    const { container } = render(
      <CollapsiblePanel header="Section">Content</CollapsiblePanel>,
    );
    expect(container.querySelector('details')).not.toHaveAttribute('open');
    expect(screen.getByText('Section')).toBeInTheDocument();
  });

  it('renders open when open=true', () => {
    const { container } = render(
      <CollapsiblePanel header="Section" open>
        Content
      </CollapsiblePanel>,
    );
    expect(container.querySelector('details')).toHaveAttribute('open');
  });

  it('applies variant and size', () => {
    const { container } = render(
      <CollapsiblePanel header="X" variant="outline" size="sm">
        Y
      </CollapsiblePanel>,
    );
    const details = container.querySelector('details');
    expect(details).toHaveAttribute('data-variant', 'outline');
    expect(details).toHaveAttribute('data-size', 'sm');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd packages/react-ui && npx vitest run`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write implementations**

dialog-panel.tsx — uses same div-based markup as Angular (backdrop + panel divs) for CSS compatibility with `packages/design-system/components-forms.css`:
```tsx
import { type ReactNode, useEffect } from 'react';

export interface DialogPanelProps {
  variant?: 'default' | 'destructive';
  onClose?: () => void;
  title?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

export function DialogPanel({
  variant = 'default',
  onClose,
  title,
  footer,
  children,
}: DialogPanelProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <>
      <div
        className="dialog-backdrop"
        onClick={() => onClose?.()}
        aria-hidden="true"
      />
      <div
        className="dialog-panel"
        data-variant={variant}
        role="dialog"
        aria-modal="true"
      >
        {title && <div className="dialog-title">{title}</div>}
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </>
  );
}
```

collapsible-panel.tsx:
```tsx
import { type ReactNode } from 'react';

export interface CollapsiblePanelProps {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'sm' | 'default' | 'lg';
  open?: boolean;
  header?: ReactNode;
  children?: ReactNode;
}

export function CollapsiblePanel({
  variant = 'default',
  size = 'default',
  open = false,
  header,
  children,
}: CollapsiblePanelProps) {
  return (
    <details
      className="collapsible-panel"
      data-variant={variant}
      data-size={size}
      open={open}
    >
      <summary className="collapsible-panel-trigger">
        {header}
        <svg
          className="collapsible-panel-chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="collapsible-panel-content">{children}</div>
    </details>
  );
}
```

- [ ] **Step 4: Export from index.ts**

Append to index.ts:
```typescript
export { DialogPanel, type DialogPanelProps } from './dialog-panel';
export { CollapsiblePanel, type CollapsiblePanelProps } from './collapsible-panel';
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `cd packages/react-ui && npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/react-ui/src/dialog-panel.tsx packages/react-ui/src/dialog-panel.spec.tsx \
  packages/react-ui/src/collapsible-panel.tsx packages/react-ui/src/collapsible-panel.spec.tsx \
  packages/react-ui/src/index.ts
git commit -m "feat(react-ui): add DialogPanel and CollapsiblePanel

DialogPanel: backdrop + panel divs, escape key + backdrop click to close.
CollapsiblePanel: native <details> element with chevron icon."
```

---

### Task 5: Layout Components

**Files:**
- Create: `packages/react-ui/src/page-layout.tsx`
- Create: `packages/react-ui/src/page-layout.spec.tsx`
- Create: `packages/react-ui/src/page-header.tsx`
- Create: `packages/react-ui/src/page-header.spec.tsx`
- Create: `packages/react-ui/src/tab-nav.tsx`
- Create: `packages/react-ui/src/tab-nav.spec.tsx`
- Modify: `packages/react-ui/src/index.ts`

- [ ] **Step 1: Write failing tests**

page-layout.spec.tsx:
```tsx
import { render, screen } from '@testing-library/react';
import { PageLayout } from './page-layout';

describe('PageLayout', () => {
  it('renders header, main, and footer sections', () => {
    render(
      <PageLayout header={<div>Header</div>} footer={<div>Footer</div>}>
        Main content
      </PageLayout>,
    );
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Main content')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('omits header and footer when not provided', () => {
    const { container } = render(<PageLayout>Just main</PageLayout>);
    expect(container.querySelector('.page-layout-header')).toBeNull();
    expect(container.querySelector('.page-layout-footer')).toBeNull();
  });
});
```

page-header.spec.tsx:
```tsx
import { render, screen } from '@testing-library/react';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('renders title and subtitle', () => {
    render(<PageHeader title="Admin" subtitle="Manage users" />);
    expect(screen.getByRole('heading', { name: 'Admin' })).toBeInTheDocument();
    expect(screen.getByText('Manage users')).toBeInTheDocument();
  });

  it('renders actions slot', () => {
    render(<PageHeader title="T" actions={<button>Add</button>} />);
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('omits subtitle and actions when not provided', () => {
    const { container } = render(<PageHeader title="Title" />);
    expect(container.querySelector('.page-header-subtitle')).toBeNull();
    expect(container.querySelector('.page-header-actions')).toBeNull();
  });
});
```

tab-nav.spec.tsx:
```tsx
import { render, screen } from '@testing-library/react';
import { TabNav, TabLink } from './tab-nav';

describe('TabNav + TabLink', () => {
  it('renders tab links inside nav', () => {
    render(
      <TabNav>
        <TabLink href="/a">Tab A</TabLink>
        <TabLink href="/b" active>Tab B</TabLink>
      </TabNav>,
    );
    expect(screen.getByText('Tab A')).toHaveClass('tab-link');
    expect(screen.getByText('Tab A')).not.toHaveClass('active');
    expect(screen.getByText('Tab B')).toHaveClass('tab-link', 'active');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd packages/react-ui && npx vitest run`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write implementations**

page-layout.tsx:
```tsx
import { type ReactNode } from 'react';

export interface PageLayoutProps {
  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

export function PageLayout({ header, footer, children }: PageLayoutProps) {
  return (
    <div className="page-layout">
      {header && <header className="page-layout-header">{header}</header>}
      <main className="page-layout-main">{children}</main>
      {footer && <footer className="page-layout-footer">{footer}</footer>}
    </div>
  );
}
```

page-header.tsx:
```tsx
import { type ReactNode } from 'react';

export interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-heading">
        {title && <h1 className="page-header-title">{title}</h1>}
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
```

tab-nav.tsx — TabLink uses CSS class `active` (matching Angular's `routerLinkActive="active"` pattern):
```tsx
import { type AnchorHTMLAttributes, type ReactNode } from 'react';

export interface TabNavProps {
  children?: ReactNode;
}

export function TabNav({ children }: TabNavProps) {
  return <nav className="tab-nav">{children}</nav>;
}

export interface TabLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  active?: boolean;
  children?: ReactNode;
}

export function TabLink({
  active,
  className,
  children,
  ...props
}: TabLinkProps) {
  const classes = ['tab-link'];
  if (active) classes.push('active');
  if (className) classes.push(className);

  return (
    <a className={classes.join(' ')} {...props}>
      {children}
    </a>
  );
}
```

- [ ] **Step 4: Export from index.ts**

Append:
```typescript
export { PageLayout, type PageLayoutProps } from './page-layout';
export { PageHeader, type PageHeaderProps } from './page-header';
export { TabNav, type TabNavProps, TabLink, type TabLinkProps } from './tab-nav';
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `cd packages/react-ui && npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/react-ui/src/page-layout.tsx packages/react-ui/src/page-layout.spec.tsx \
  packages/react-ui/src/page-header.tsx packages/react-ui/src/page-header.spec.tsx \
  packages/react-ui/src/tab-nav.tsx packages/react-ui/src/tab-nav.spec.tsx \
  packages/react-ui/src/index.ts
git commit -m "feat(react-ui): add PageLayout, PageHeader, TabNav, TabLink

Pure layout wrappers using design system CSS classes.
TabLink accepts active prop for router integration."
```

---

### Task 6: HistogramTimeline

**Files:**
- Create: `packages/react-ui/src/histogram-timeline.tsx`
- Create: `packages/react-ui/src/histogram-timeline.spec.tsx`
- Modify: `packages/react-ui/src/index.ts`

- [ ] **Step 1: Write failing test**

histogram-timeline.spec.tsx:
```tsx
import { render, screen } from '@testing-library/react';
import { HistogramTimeline } from './histogram-timeline';

describe('HistogramTimeline', () => {
  const bars = [{ value: 10 }, { value: 20 }, { value: 5 }];

  it('renders correct number of bars', () => {
    const { container } = render(
      <HistogramTimeline bars={bars} ariaLabel="Activity" />,
    );
    expect(container.querySelectorAll('.histogram-bar')).toHaveLength(3);
  });

  it('normalizes bar values as CSS variable', () => {
    const { container } = render(
      <HistogramTimeline bars={bars} ariaLabel="Activity" />,
    );
    const barEls =
      container.querySelectorAll<HTMLElement>('.histogram-bar');
    // Max is 20: 10/20=0.5, 20/20=1, 5/20=0.25
    expect(barEls[0].style.getPropertyValue('--bar-value')).toBe('0.5');
    expect(barEls[1].style.getPropertyValue('--bar-value')).toBe('1');
    expect(barEls[2].style.getPropertyValue('--bar-value')).toBe('0.25');
  });

  it('applies variant', () => {
    const { container } = render(
      <HistogramTimeline bars={bars} ariaLabel="X" variant="success" />,
    );
    expect(container.querySelector('.histogram-timeline')).toHaveAttribute(
      'data-variant',
      'success',
    );
  });

  it('renders labels', () => {
    render(
      <HistogramTimeline
        bars={bars}
        ariaLabel="X"
        labels={[
          { index: 0, text: 'Start' },
          { index: 2, text: 'End' },
        ]}
      />,
    );
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('End')).toBeInTheDocument();
  });

  it('has accessible role and label', () => {
    render(<HistogramTimeline bars={bars} ariaLabel="Weekly activity" />);
    expect(
      screen.getByRole('img', { name: 'Weekly activity' }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd packages/react-ui && npx vitest run`
Expected: FAIL.

- [ ] **Step 3: Write implementation**

histogram-timeline.tsx:
```tsx
import { type CSSProperties, useMemo } from 'react';

export interface HistogramBar {
  value: number;
}

export interface HistogramLabel {
  index: number;
  text: string;
}

export type HistogramVariant = 'default' | 'success' | 'destructive' | 'muted';

export interface HistogramTimelineProps {
  bars: HistogramBar[];
  labels?: HistogramLabel[];
  ariaLabel: string;
  variant?: HistogramVariant;
}

export function HistogramTimeline({
  bars,
  labels = [],
  ariaLabel,
  variant = 'default',
}: HistogramTimelineProps) {
  const maxValue = useMemo(
    () => Math.max(...bars.map((b) => b.value), 1),
    [bars],
  );

  return (
    <div
      className="histogram-timeline"
      data-variant={variant}
      role="img"
      aria-label={ariaLabel}
    >
      <div className="histogram-bars">
        {bars.map((bar, i) => (
          <div
            key={i}
            className="histogram-bar"
            style={
              { '--bar-value': bar.value / maxValue } as CSSProperties
            }
          />
        ))}
      </div>
      {labels.length > 0 && (
        <div
          className="histogram-labels"
          style={{ '--bar-count': bars.length } as CSSProperties}
        >
          {labels.map((label) => (
            <span
              key={label.index}
              className="histogram-label"
              style={
                { '--label-position': label.index } as CSSProperties
              }
            >
              {label.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Export from index.ts**

Append:
```typescript
export {
  HistogramTimeline,
  type HistogramTimelineProps,
  type HistogramBar,
  type HistogramLabel,
  type HistogramVariant,
} from './histogram-timeline';
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `cd packages/react-ui && npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/react-ui/src/histogram-timeline.tsx \
  packages/react-ui/src/histogram-timeline.spec.tsx \
  packages/react-ui/src/index.ts
git commit -m "feat(react-ui): add HistogramTimeline component

Bar chart using CSS variables for height normalization.
Supports variant, labels, and accessible role=img."
```

---

### Task 7: DataTable

**Files:**
- Create: `packages/react-ui/src/data-table.tsx`
- Create: `packages/react-ui/src/data-table.spec.tsx`
- Modify: `packages/react-ui/src/index.ts`

Note: `@tanstack/react-table` is already in package.json dependencies from Task 1.

- [ ] **Step 1: Write failing test**

data-table.spec.tsx — note test data has Bob before Alice to verify sorting actually reorders rows:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, type DataTableColumn } from './data-table';

interface User {
  name: string;
  email: string;
  role: string;
}

const users: User[] = [
  { name: 'Bob', email: 'bob@test.com', role: 'user' },
  { name: 'Alice', email: 'alice@test.com', role: 'admin' },
];

const columns: DataTableColumn<User>[] = [
  { accessor: 'name', header: 'Name', sortable: true },
  { accessor: 'email', header: 'Email' },
  {
    accessor: 'role',
    header: 'Role',
    cell: (row) => <strong>{row.role}</strong>,
  },
];

describe('DataTable', () => {
  it('renders header cells and data rows', () => {
    render(<DataTable data={users} columns={columns} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
  });

  it('renders custom cell content', () => {
    render(<DataTable data={users} columns={columns} />);
    const adminCell = screen.getByText('admin');
    expect(adminCell.tagName).toBe('STRONG');
  });

  it('sorts ascending then descending on sortable column click', async () => {
    render(<DataTable data={users} columns={columns} />);
    const nameHeader = screen.getByText('Name');

    // Ascending: Alice before Bob
    await userEvent.click(nameHeader);
    let rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Alice');
    expect(rows[2]).toHaveTextContent('Bob');

    // Descending: Bob before Alice
    await userEvent.click(nameHeader);
    rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Bob');
    expect(rows[2]).toHaveTextContent('Alice');
  });

  it('fires onRowClick for clickable rows', async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        data={users}
        columns={columns}
        clickableRows
        onRowClick={onRowClick}
      />,
    );
    await userEvent.click(screen.getByText('Bob'));
    expect(onRowClick).toHaveBeenCalledWith(users[0]);
  });

  it('supports keyboard Enter on clickable rows', async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        data={users}
        columns={columns}
        clickableRows
        onRowClick={onRowClick}
      />,
    );
    const firstRow = screen.getAllByRole('row')[1];
    firstRow.focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledWith(users[0]);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd packages/react-ui && npx vitest run`
Expected: FAIL.

- [ ] **Step 3: Write implementation**

data-table.tsx:
```tsx
import { type ReactNode, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table';

export interface DataTableColumn<T> {
  accessor: keyof T & string;
  header: string;
  sortable?: boolean;
  cell?: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  clickableRows?: boolean;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  data,
  columns,
  clickableRows = false,
  onRowClick,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const tanstackColumns = useMemo<ColumnDef<T, unknown>[]>(
    () =>
      columns.map((col) => ({
        accessorKey: col.accessor,
        header: col.header,
        enableSorting: col.sortable ?? false,
        cell: col.cell
          ? ({ row }) => col.cell!(row.original)
          : ({ getValue }) => String(getValue() ?? ''),
      })),
    [columns],
  );

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="data-table">
      <table className="data-table-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="data-table-header-row">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={
                    header.column.getCanSort()
                      ? 'data-table-header-cell data-table-header-cell-sortable'
                      : 'data-table-header-cell'
                  }
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="data-table-header-cell-content">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {header.column.getCanSort() && (
                      <span
                        className="data-table-sort-icon"
                        data-active={
                          header.column.getIsSorted() ? 'true' : undefined
                        }
                        data-direction={
                          header.column.getIsSorted() || undefined
                        }
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="6 15 12 9 18 15" />
                        </svg>
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="data-table-row"
              data-clickable={clickableRows || undefined}
              onClick={
                clickableRows
                  ? () => onRowClick?.(row.original)
                  : undefined
              }
              onKeyDown={
                clickableRows
                  ? (e) => {
                      if (e.key === 'Enter') onRowClick?.(row.original);
                    }
                  : undefined
              }
              tabIndex={clickableRows ? 0 : undefined}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="data-table-cell">
                  {flexRender(
                    cell.column.columnDef.cell,
                    cell.getContext(),
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Export from index.ts**

Append:
```typescript
export { DataTable, type DataTableProps, type DataTableColumn } from './data-table';
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `cd packages/react-ui && npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/react-ui/src/data-table.tsx packages/react-ui/src/data-table.spec.tsx \
  packages/react-ui/src/index.ts
git commit -m "feat(react-ui): add DataTable component with TanStack Table v8

Supports sortable columns, clickable rows with keyboard a11y,
and custom cell renderers. Column definition via typed props array."
```

---

### Task 8: Monorepo Integration

**Files:**
- Verify: `packages/react-ui/src/index.ts` exports all components
- Modify: `Makefile` (add react-ui test to validate chain)

- [ ] **Step 1: Verify index.ts exports all 13 components + types**

Read `packages/react-ui/src/index.ts` and confirm it exports: Button, Badge, Input, FormError, DialogPanel, CollapsiblePanel, PageLayout, PageHeader, TabNav, TabLink, HistogramTimeline, DataTable, plus all `Props`, `Variant`, `Size`, `HistogramBar`, `HistogramLabel`, and `DataTableColumn` type exports.

- [ ] **Step 2: Run full test suite**

Run: `cd packages/react-ui && npx vitest run`
Expected: All tests pass (~20+ tests across 8 test files).

- [ ] **Step 3: Add react-ui to Makefile validate target**

Add a `test-react-ui` target and wire it into the `test` dependency chain:

```makefile
test-react-ui: ## Run React UI library tests
	cd packages/react-ui && npx vitest run
```

Update the `validate` target dependencies:
```makefile
validate: lint-arch lint-length lint test test-react-ui ## Validate everything
```

- [ ] **Step 4: Run make validate**

Run: `make validate`
Expected: All existing tests + react-ui tests pass.

- [ ] **Step 5: Commit**

```bash
git add Makefile
git commit -m "chore: wire @aspect/react-ui tests into make validate"
```

---

## Follow-Up: Main App Migration

This plan delivers a tested `@aspect/react-ui` package. The **next plan** will cover converting `apps/main/frontend` from Angular to React:

1. Scaffold a Vite + React app alongside or replacing the Angular app
2. Set up React Router, auth (keycloak-js), and API client layer
3. Migrate features one-by-one: landing → register → dashboard → admin-permissions
4. Port NgRx signal stores to Zustand or simple React state
5. Update E2E tests (Playwright stays, only selectors change)
