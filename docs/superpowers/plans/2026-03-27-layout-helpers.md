# Layout Helper Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Stack, Grid, and Cell layout components to `@aspect/react-ui` that wrap existing design-system CSS.

**Architecture:** Thin React wrappers over existing `.stack` and `.layout-grid` CSS classes from `@aspect/design-system`. Props map to `data-*` attributes. No new runtime dependencies.

**Tech Stack:** React 19, TypeScript (strict), Vitest, React Testing Library

**Spec:** `docs/superpowers/specs/2026-03-27-layout-helpers-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `packages/design-system/components-layout.css` | Add missing `data-gap="2xl"` to `.layout-grid` |
| Create | `packages/react-ui/src/stack.tsx` | Stack component + StackProps type |
| Create | `packages/react-ui/src/stack.spec.tsx` | Stack tests |
| Create | `packages/react-ui/src/grid.tsx` | Grid + Cell components + types |
| Create | `packages/react-ui/src/grid.spec.tsx` | Grid + Cell tests |
| Modify | `packages/react-ui/src/index.ts` | Add Stack, Grid, Cell exports |

---

### Task 1: CSS prerequisite — add `data-gap="2xl"` to `.layout-grid`

**Files:**
- Modify: `packages/design-system/components-layout.css`

- [ ] **Step 1: Add `data-gap="2xl"` rule to `.layout-grid`**

In `packages/design-system/components-layout.css`, inside the `.layout-grid` block, add the missing gap rule after the `xl` rule:

```css
  &[data-gap="2xl"] { gap: var(--spacing-2xl); }
```

This matches the existing `data-gap="2xl"` rule in `.stack`.

- [ ] **Step 2: Commit**

```bash
git add packages/design-system/components-layout.css
git commit -m "fix(design-system): add missing data-gap 2xl to layout-grid"
```

---

### Task 2: Stack component — tests

**Files:**
- Create: `packages/react-ui/src/stack.spec.tsx`

- [ ] **Step 1: Write Stack tests**

```tsx
import { render, screen } from '@testing-library/react';
import { Stack } from './stack';

describe('Stack', () => {
  it('renders with stack class', () => {
    render(<Stack data-testid="s">content</Stack>);
    const el = screen.getByTestId('s');
    expect(el).toHaveClass('stack');
    expect(el.tagName).toBe('DIV');
  });

  it('emits data-gap with default md', () => {
    render(<Stack data-testid="s">content</Stack>);
    expect(screen.getByTestId('s')).toHaveAttribute('data-gap', 'md');
  });

  it('maps gap prop to data-gap', () => {
    render(<Stack gap="lg" data-testid="s">content</Stack>);
    expect(screen.getByTestId('s')).toHaveAttribute('data-gap', 'lg');
  });

  it('emits data-direction only for horizontal', () => {
    const { rerender } = render(<Stack data-testid="s">content</Stack>);
    expect(screen.getByTestId('s')).not.toHaveAttribute('data-direction');

    rerender(<Stack direction="horizontal" data-testid="s">content</Stack>);
    expect(screen.getByTestId('s')).toHaveAttribute('data-direction', 'horizontal');
  });

  it('maps align and justify to data attributes', () => {
    render(<Stack align="center" justify="between" data-testid="s">content</Stack>);
    const el = screen.getByTestId('s');
    expect(el).toHaveAttribute('data-align', 'center');
    expect(el).toHaveAttribute('data-justify', 'between');
  });

  it('omits data-align and data-justify when undefined', () => {
    render(<Stack data-testid="s">content</Stack>);
    const el = screen.getByTestId('s');
    expect(el).not.toHaveAttribute('data-align');
    expect(el).not.toHaveAttribute('data-justify');
  });

  it('applies fill inline styles when fill is true', () => {
    render(<Stack fill data-testid="s">content</Stack>);
    const el = screen.getByTestId('s');
    expect(el.style.flex).toBe('1');
    expect(el.style.minHeight).toBe('0');
  });

  it('does not apply fill styles when fill is false', () => {
    render(<Stack data-testid="s">content</Stack>);
    const el = screen.getByTestId('s');
    expect(el.style.flex).toBe('');
  });

  it('merges caller style with fill styles', () => {
    render(<Stack fill style={{ color: 'red' }} data-testid="s">content</Stack>);
    const el = screen.getByTestId('s');
    expect(el.style.flex).toBe('1');
    expect(el.style.minHeight).toBe('0');
    expect(el.style.color).toBe('red');
  });

  it('renders as a different element via as prop', () => {
    render(<Stack as="section" data-testid="s">content</Stack>);
    expect(screen.getByTestId('s').tagName).toBe('SECTION');
  });

  it('merges additional className', () => {
    render(<Stack className="card mb-sm" data-testid="s">content</Stack>);
    const el = screen.getByTestId('s');
    expect(el).toHaveClass('stack');
    expect(el).toHaveClass('card');
    expect(el).toHaveClass('mb-sm');
  });

  it('spreads HTML attributes', () => {
    render(<Stack id="main" aria-label="test" data-testid="s">content</Stack>);
    const el = screen.getByTestId('s');
    expect(el).toHaveAttribute('id', 'main');
    expect(el).toHaveAttribute('aria-label', 'test');
  });

  it('renders children', () => {
    render(<Stack><span>child</span></Stack>);
    expect(screen.getByText('child')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/react-ui && npx vitest run src/stack.spec.tsx
```

Expected: FAIL — `./stack` module not found.

- [ ] **Step 3: Commit**

```bash
git add packages/react-ui/src/stack.spec.tsx
git commit -m "test(react-ui): add Stack component tests (red)"
```

---

### Task 3: Stack component — implementation

**Files:**
- Create: `packages/react-ui/src/stack.tsx`

- [ ] **Step 1: Implement Stack component**

```tsx
import { type ElementType, type HTMLAttributes, type ReactNode, createElement } from 'react';

export type StackGap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface StackProps extends HTMLAttributes<HTMLElement> {
  /** Stack direction. Default: `'vertical'`. */
  direction?: 'vertical' | 'horizontal';
  /** Gap between children. Default: `'md'`. */
  gap?: StackGap;
  /** Cross-axis alignment. */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** Main-axis distribution. */
  justify?: 'start' | 'center' | 'end' | 'between';
  /** Grow to fill parent flex container (`flex: 1; min-height: 0`). */
  fill?: boolean;
  /** HTML element to render. Default: `'div'`. */
  as?: ElementType;
  children?: ReactNode;
}

export function Stack({
  direction = 'vertical',
  gap = 'md',
  align,
  justify,
  fill = false,
  as = 'div',
  className,
  style,
  children,
  ...rest
}: StackProps) {
  return createElement(
    as,
    {
      className: className ? `stack ${className}` : 'stack',
      'data-gap': gap,
      ...(direction === 'horizontal' ? { 'data-direction': 'horizontal' } : undefined),
      ...(align ? { 'data-align': align } : undefined),
      ...(justify ? { 'data-justify': justify } : undefined),
      style: fill ? { flex: 1, minHeight: 0, ...style } : style,
      ...rest,
    },
    children,
  );
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd packages/react-ui && npx vitest run src/stack.spec.tsx
```

Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add packages/react-ui/src/stack.tsx
git commit -m "feat(react-ui): add Stack layout component"
```

---

### Task 4: Grid and Cell components — tests

**Files:**
- Create: `packages/react-ui/src/grid.spec.tsx`

- [ ] **Step 1: Write Grid and Cell tests**

```tsx
import { render, screen } from '@testing-library/react';
import { Cell, Grid } from './grid';

describe('Grid', () => {
  it('renders with layout-grid class', () => {
    render(<Grid data-testid="g">content</Grid>);
    const el = screen.getByTestId('g');
    expect(el).toHaveClass('layout-grid');
    expect(el.tagName).toBe('DIV');
  });

  it('sets --grid-cols CSS variable for numeric columns', () => {
    render(<Grid columns={4} data-testid="g">content</Grid>);
    expect(screen.getByTestId('g').style.getPropertyValue('--grid-cols')).toBe('4');
  });

  it('sets gridTemplateColumns for string columns', () => {
    render(<Grid columns="2fr 1fr" data-testid="g">content</Grid>);
    expect(screen.getByTestId('g').style.gridTemplateColumns).toBe('2fr 1fr');
  });

  it('does not set column styles when columns is undefined', () => {
    render(<Grid data-testid="g">content</Grid>);
    const el = screen.getByTestId('g');
    expect(el.style.getPropertyValue('--grid-cols')).toBe('');
    expect(el.style.gridTemplateColumns).toBe('');
  });

  it('emits data-gap with default md', () => {
    render(<Grid data-testid="g">content</Grid>);
    expect(screen.getByTestId('g')).toHaveAttribute('data-gap', 'md');
  });

  it('maps gap prop to data-gap', () => {
    render(<Grid gap="sm" data-testid="g">content</Grid>);
    expect(screen.getByTestId('g')).toHaveAttribute('data-gap', 'sm');
  });

  it('applies fill inline styles when fill is true', () => {
    render(<Grid fill data-testid="g">content</Grid>);
    const el = screen.getByTestId('g');
    expect(el.style.flex).toBe('1');
    expect(el.style.minHeight).toBe('0');
  });

  it('does not apply fill styles when fill is false', () => {
    render(<Grid data-testid="g">content</Grid>);
    expect(screen.getByTestId('g').style.flex).toBe('');
  });

  it('merges columns, fill, and caller style', () => {
    render(<Grid columns={3} fill style={{ color: 'red' }} data-testid="g">content</Grid>);
    const el = screen.getByTestId('g');
    expect(el.style.getPropertyValue('--grid-cols')).toBe('3');
    expect(el.style.flex).toBe('1');
    expect(el.style.color).toBe('red');
  });

  it('renders as a different element via as prop', () => {
    render(<Grid as="nav" data-testid="g">content</Grid>);
    expect(screen.getByTestId('g').tagName).toBe('NAV');
  });

  it('merges additional className', () => {
    render(<Grid className="p-md" data-testid="g">content</Grid>);
    const el = screen.getByTestId('g');
    expect(el).toHaveClass('layout-grid');
    expect(el).toHaveClass('p-md');
  });

  it('spreads HTML attributes', () => {
    render(<Grid id="grid1" aria-label="stats" data-testid="g">content</Grid>);
    const el = screen.getByTestId('g');
    expect(el).toHaveAttribute('id', 'grid1');
    expect(el).toHaveAttribute('aria-label', 'stats');
  });

  it('renders children', () => {
    render(<Grid><span>child</span></Grid>);
    expect(screen.getByText('child')).toBeInTheDocument();
  });
});

describe('Cell', () => {
  it('renders as a plain div by default', () => {
    render(<Cell data-testid="c">content</Cell>);
    const el = screen.getByTestId('c');
    expect(el.tagName).toBe('DIV');
  });

  it('applies no inline styles when no placement props given', () => {
    render(<Cell data-testid="c">content</Cell>);
    const el = screen.getByTestId('c');
    expect(el.style.gridColumn).toBe('');
    expect(el.style.gridColumnStart).toBe('');
    expect(el.style.gridRow).toBe('');
  });

  it('sets gridColumn for numeric span', () => {
    render(<Cell span={2} data-testid="c">content</Cell>);
    expect(screen.getByTestId('c').style.gridColumn).toBe('span 2');
  });

  it('sets gridColumn to 1 / -1 for span="full"', () => {
    render(<Cell span="full" data-testid="c">content</Cell>);
    expect(screen.getByTestId('c').style.gridColumn).toBe('1 / -1');
  });

  it('sets gridColumnStart for start prop', () => {
    render(<Cell start={2} data-testid="c">content</Cell>);
    expect(screen.getByTestId('c').style.gridColumnStart).toBe('2');
  });

  it('sets gridRow for rowSpan prop', () => {
    render(<Cell rowSpan={3} data-testid="c">content</Cell>);
    expect(screen.getByTestId('c').style.gridRow).toBe('span 3');
  });

  it('combines span and start', () => {
    render(<Cell start={2} span={2} data-testid="c">content</Cell>);
    const el = screen.getByTestId('c');
    expect(el.style.gridColumn).toBe('span 2');
    expect(el.style.gridColumnStart).toBe('2');
  });

  it('renders as a different element via as prop', () => {
    render(<Cell as="li" data-testid="c">content</Cell>);
    expect(screen.getByTestId('c').tagName).toBe('LI');
  });

  it('merges className', () => {
    render(<Cell className="card" data-testid="c">content</Cell>);
    expect(screen.getByTestId('c')).toHaveClass('card');
  });

  it('spreads HTML attributes', () => {
    render(<Cell id="c1" aria-label="wide" data-testid="c">content</Cell>);
    const el = screen.getByTestId('c');
    expect(el).toHaveAttribute('id', 'c1');
    expect(el).toHaveAttribute('aria-label', 'wide');
  });

  it('renders children', () => {
    render(<Cell><span>child</span></Cell>);
    expect(screen.getByText('child')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/react-ui && npx vitest run src/grid.spec.tsx
```

Expected: FAIL — `./grid` module not found.

- [ ] **Step 3: Commit**

```bash
git add packages/react-ui/src/grid.spec.tsx
git commit -m "test(react-ui): add Grid and Cell component tests (red)"
```

---

### Task 5: Grid and Cell components — implementation

**Files:**
- Create: `packages/react-ui/src/grid.tsx`

- [ ] **Step 1: Implement Grid and Cell components**

```tsx
import { type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode, createElement } from 'react';

export type GridGap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface GridProps extends HTMLAttributes<HTMLElement> {
  /** Column definition. Number → `repeat(n, 1fr)`. String → `gridTemplateColumns` value. */
  columns?: number | string;
  /** Gap between cells. Default: `'md'`. */
  gap?: GridGap;
  /** Grow to fill parent flex container (`flex: 1; min-height: 0`). */
  fill?: boolean;
  /** HTML element to render. Default: `'div'`. */
  as?: ElementType;
  children?: ReactNode;
}

export function Grid({
  columns,
  gap = 'md',
  fill = false,
  as = 'div',
  className,
  style,
  children,
  ...rest
}: GridProps) {
  const columnStyle: CSSProperties =
    columns === undefined
      ? {}
      : typeof columns === 'number'
        ? { '--grid-cols': columns } as CSSProperties
        : { gridTemplateColumns: columns };

  return createElement(
    as,
    {
      className: className ? `layout-grid ${className}` : 'layout-grid',
      'data-gap': gap,
      style: {
        ...columnStyle,
        ...(fill ? { flex: 1, minHeight: 0 } : undefined),
        ...style,
      },
      ...rest,
    },
    children,
  );
}

export interface CellProps extends HTMLAttributes<HTMLElement> {
  /** Column span. Number → `span N`. `'full'` → `1 / -1`. */
  span?: number | 'full';
  /** Column start position. */
  start?: number;
  /** Row span. */
  rowSpan?: number;
  /** HTML element to render. Default: `'div'`. */
  as?: ElementType;
  children?: ReactNode;
}

export function Cell({
  span,
  start,
  rowSpan,
  as = 'div',
  style,
  children,
  ...rest
}: CellProps) {
  const cellStyle: CSSProperties = {
    ...(span !== undefined
      ? { gridColumn: span === 'full' ? '1 / -1' : `span ${span}` }
      : undefined),
    ...(start !== undefined ? { gridColumnStart: start } : undefined),
    ...(rowSpan !== undefined ? { gridRow: `span ${rowSpan}` } : undefined),
    ...style,
  };

  const hasStyles = Object.keys(cellStyle).length > 0;

  return createElement(
    as,
    {
      ...(hasStyles ? { style: cellStyle } : undefined),
      ...rest,
    },
    children,
  );
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd packages/react-ui && npx vitest run src/grid.spec.tsx
```

Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add packages/react-ui/src/grid.tsx
git commit -m "feat(react-ui): add Grid and Cell layout components"
```

---

### Task 6: Export from index + full test suite run

**Files:**
- Modify: `packages/react-ui/src/index.ts`

- [ ] **Step 1: Add exports to index.ts**

Add these two lines at the end of `packages/react-ui/src/index.ts`:

```ts
export { Stack, type StackProps, type StackGap } from './stack';
export { Grid, type GridProps, type GridGap, Cell, type CellProps } from './grid';
```

- [ ] **Step 2: Run the full test suite**

```bash
cd packages/react-ui && npx vitest run
```

Expected: ALL tests pass (existing + new).

- [ ] **Step 3: Run TypeScript check**

```bash
cd packages/react-ui && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/react-ui/src/index.ts
git commit -m "feat(react-ui): export Stack, Grid, and Cell from package"
```
