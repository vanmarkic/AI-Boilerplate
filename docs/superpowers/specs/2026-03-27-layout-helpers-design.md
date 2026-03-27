# Layout Helper Components — Design Spec

**Package:** `@aspect/react-ui` (`packages/react-ui/`)
**Date:** 2026-03-27

## Problem

Layout patterns repeat across the React frontend with raw utility classes and inline styles:

- `className="flex flex-col gap-md"` — 15+ occurrences
- `className="flex items-center justify-between"` — 8+ occurrences
- `className="grid gap-md" style={{ gridTemplateColumns: '...' }}` — 6+ occurrences
- `style={{ flex: 1, minHeight: 0 }}` — 6+ occurrences (overflow fill pattern)

These are low-level CSS details that should be abstracted into typed, composable components.

## Solution

Three layout components: **Stack**, **Grid**, and **Cell**.

Stack and Grid are container components that share a `fill` prop for flex-grow behavior. Cell is a grid-child component for placement control.

All three wrap existing CSS classes from `@aspect/design-system` (`components-layout.css`), using the established data-attribute pattern for variants.

## Components

### Stack

Flex container for vertical or horizontal stacking with consistent gaps.

**CSS basis:** `.stack` class (already exists in `components-layout.css`).

**Props:**

| Prop | Type | Default | Maps to |
|------|------|---------|---------|
| `direction` | `'vertical' \| 'horizontal'` | `'vertical'` | `data-direction` (`'horizontal'` only — vertical is the CSS default) |
| `gap` | `'none' \| 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| '2xl'` | `'md'` | `data-gap` (always emitted) |
| `align` | `'start' \| 'center' \| 'end' \| 'stretch'` | — | `data-align` (omitted when undefined) |
| `justify` | `'start' \| 'center' \| 'end' \| 'between'` | — | `data-justify` (omitted when undefined) |
| `fill` | `boolean` | `false` | inline `flex: 1; minHeight: 0` |
| `as` | `ElementType` | `'div'` | rendered element |
| `...rest` | `HTMLAttributes<HTMLElement>` | — | spread onto element |

**Rendering:** Applies `className="stack"`, always emits `data-gap` (since it has a default), emits `data-direction` only for `'horizontal'` (CSS default handles vertical), and emits `data-align`/`data-justify` only when defined. Merges caller's `className` if provided.

**Note:** Horizontal direction uses `flex-flow: row wrap` in the CSS, so horizontal stacks wrap by default.

**Usage:**

```tsx
<Stack gap="lg">                                     {/* vertical, large gap */}
<Stack direction="horizontal" align="center" justify="between">  {/* toolbar row */}
<Stack as="form" gap="sm" onSubmit={handleSubmit}>   {/* form layout */}
<Stack gap="md" fill>                                {/* fills parent flex */}
```

**Replaces patterns:**

```tsx
{/* Before */}
<div className="flex flex-col gap-lg">
<div className="flex items-center justify-between">
<div className="flex flex-col gap-sm" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>

{/* After */}
<Stack gap="lg">
<Stack direction="horizontal" align="center" justify="between">
<Stack gap="sm" fill>
```

### Grid

CSS Grid container with typed column configuration.

**CSS basis:** `.layout-grid` class (already exists in `components-layout.css`).

**Props:**

| Prop | Type | Default | Maps to |
|------|------|---------|---------|
| `columns` | `number \| string` | — | `number` → CSS var `--grid-cols`; `string` → inline `gridTemplateColumns` |
| `gap` | `'none' \| 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| '2xl'` | `'md'` | `data-gap` (always emitted) |
| `fill` | `boolean` | `false` | inline `flex: 1; minHeight: 0` |
| `as` | `ElementType` | `'div'` | rendered element |
| `...rest` | `HTMLAttributes<HTMLElement>` | — | spread onto element |

**CSS prerequisite:** `.layout-grid` in `components-layout.css` is missing `data-gap="2xl"`. Add it during implementation to match `.stack`.

**Column resolution:**
- `columns={4}` → sets `--grid-cols: 4` (the `.layout-grid` CSS uses `repeat(var(--grid-cols), 1fr)`)
- `columns="2fr 1fr"` → sets inline `gridTemplateColumns: '2fr 1fr'` directly

**Usage:**

```tsx
<Grid columns={4} gap="md">          {/* 4 equal columns */}
<Grid columns="2fr 1fr" fill>        {/* 2:1 ratio, fills parent */}
<Grid columns={5} gap="sm">          {/* 5-column forecast */}
```

**Replaces patterns:**

```tsx
{/* Before */}
<div className="grid gap-md" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
<div className="grid gap-md" style={{ gridTemplateColumns: '2fr 1fr', flex: 1, minHeight: 0 }}>

{/* After */}
<Grid columns={4}>
<Grid columns="2fr 1fr" fill>
```

### Cell

Grid child for controlling placement within a Grid.

**CSS basis:** Existing utilities `.col-span-2`, `.col-span-3`, `.col-span-full` cover span. Component adds typed props for `start` and `rowSpan` via inline styles.

**Props:**

| Prop | Type | Default | Maps to |
|------|------|---------|---------|
| `span` | `number \| 'full'` | — | `number` → inline `gridColumn: span N`; `'full'` → `gridColumn: 1 / -1` |
| `start` | `number` | — | inline `gridColumnStart: N` |
| `rowSpan` | `number` | — | inline `gridRow: span N` |
| `as` | `ElementType` | `'div'` | rendered element |
| `...rest` | `HTMLAttributes` | — | spread onto element |

**Usage:**

```tsx
<Grid columns={3}>
  <Cell span={2}>wide content</Cell>
  <Cell>narrow</Cell>
</Grid>

<Grid columns={4}>
  <Cell start={2} span={2}>centered content</Cell>
</Grid>
```

**Note:** Cell is optional — plain children inside Grid work fine when no placement control is needed.

## Shared Concerns

### The `fill` prop

Both Stack and Grid accept `fill: boolean`. When true, applies:

```css
flex: 1;
min-height: 0;
```

This replaces the `style={{ flex: 1, minHeight: 0 }}` pattern used throughout the dashboard layouts for overflow-safe flex children. Applied via inline style since it's a binary toggle, not a variant scale.

### The `as` prop

All three components accept `as` to control the rendered HTML element. Uses `React.ElementType` for rendering. Defaults to `'div'`. Common uses: `as="section"`, `as="nav"`, `as="form"`, `as="ul"`.

**Type safety note:** The `...rest` props are typed as `HTMLAttributes<HTMLElement>`, which means element-specific attributes (e.g., `action` on `<form>`) won't be type-checked. This is a pragmatic trade-off — full generic polymorphism (`StackProps<T extends ElementType>`) adds significant complexity for minimal gain in this use case. Consumers needing element-specific attributes can cast or use a wrapper.

### className merging

All components accept `className` via the spread rest props. The component's base class (`.stack`, `.layout-grid`) is always applied; the caller's `className` is appended. No `clsx` dependency — simple string concatenation since there's no conditional logic.

### No inline styles (except where necessary)

- Stack: zero inline styles (unless `fill` is true)
- Grid: inline style only for string `columns` and `fill`
- Cell: inline style for `span`, `start`, `rowSpan`

## File Structure

```
packages/react-ui/src/
├── stack.tsx         # Stack component + types
├── stack.spec.tsx    # Stack tests
├── grid.tsx          # Grid + Cell components + types
├── grid.spec.tsx     # Grid + Cell tests
└── index.ts          # updated exports
```

Grid and Cell are co-located in the same file since Cell is only meaningful inside Grid and the combined code will be well under 100 lines.

## Testing Strategy

Tests use Vitest + React Testing Library (matching existing pattern in the package).

**Stack tests:**
- Renders with default `.stack` class
- Maps `direction="horizontal"` to `data-direction` attribute
- Maps `gap`, `align`, `justify` to corresponding `data-*` attributes
- Omits `data-*` attributes when props are undefined
- `fill` applies inline flex styles
- `as` renders the specified element
- Merges additional `className`
- Spreads HTML attributes (e.g., `id`, `aria-label`)

**Grid tests:**
- Renders with `.layout-grid` class
- Numeric `columns` sets `--grid-cols` CSS variable
- String `columns` sets inline `gridTemplateColumns`
- Maps `gap` to `data-gap`
- `fill` applies inline flex styles
- `as` and className merging (same as Stack)

**Cell tests:**
- Renders as plain div by default
- `span` sets `gridColumn: span N`
- `start` sets `gridColumnStart`
- `rowSpan` sets `gridRow: span N`
- `as` renders specified element
- No styles applied when no placement props given

## Exports

Added to `packages/react-ui/src/index.ts`:

```ts
export { Stack, type StackProps } from './stack';
export { Grid, type GridProps, Cell, type CellProps } from './grid';
```

## Migration Example

Landing.tsx lines 109-134 (error rate section):

```tsx
{/* Before */}
<div className="grid gap-md" style={{ gridTemplateColumns: '2fr 1fr', flex: 1, minHeight: 0 }}>
  <div className="card flex flex-col" style={{ minHeight: 0 }}>
    <div className="flex items-center justify-between mb-sm">
      <h3 className="card-title">Error rate</h3>
      <Badge variant="destructive">3 spikes</Badge>
    </div>
    <div style={{ flex: 1, minHeight: 0 }}>
      <HistogramTimeline ... />
    </div>
  </div>
  <div className="card flex flex-col" style={{ minHeight: 0 }}>
    <h3 className="card-title">System</h3>
    <div className="flex flex-col gap-sm" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      ...
    </div>
  </div>
</div>

{/* After */}
<Grid columns="2fr 1fr" fill>
  <Stack className="card" fill>
    <Stack direction="horizontal" align="center" justify="between" className="mb-sm">
      <h3 className="card-title">Error rate</h3>
      <Badge variant="destructive">3 spikes</Badge>
    </Stack>
    <Stack fill>
      <HistogramTimeline ... />
    </Stack>
  </Stack>
  <Stack className="card" fill>
    <h3 className="card-title">System</h3>
    <Stack gap="sm" fill className="overflow-hidden">
      ...
    </Stack>
  </Stack>
</Grid>
```
