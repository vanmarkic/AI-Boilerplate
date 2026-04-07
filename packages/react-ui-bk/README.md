# @aspect/react-ui

Headless-style React component library. Components handle structure and behaviour; all visual styling comes from [`@aspect/design-system`](../design-system/README.md).

## Installation

```sh
npm install @aspect/react-ui @aspect/design-system
```

Then load the design system CSS once at your app entry point:

```css
/* app.css */
@import "@aspect/design-system";
```

```tsx
// main.tsx
import './app.css';
```

## How it works

Each component emits semantic class names and `data-*` attributes. The design system CSS targets those to apply visual styles. This means:

- Components carry zero inline styles and no bundled CSS
- All theming and overrides happen in CSS, not in component props
- You can replace any component's look by overriding its class in your own stylesheet

## Components

### Button

```tsx
import { Button } from '@aspect/react-ui';

<Button>Save</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline" size="sm">Cancel</Button>
<Button variant="ghost" disabled>Loading…</Button>
```

| Prop | Type | Default |
|---|---|---|
| `variant` | `'default' \| 'destructive' \| 'outline' \| 'ghost'` | `'default'` |
| `size` | `'sm' \| 'default' \| 'lg'` | `'default'` |

Extends all native `<button>` attributes.

---

### Badge

```tsx
import { Badge } from '@aspect/react-ui';

<Badge>Active</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Draft</Badge>
```

| Prop | Type | Default |
|---|---|---|
| `variant` | `'default' \| 'secondary' \| 'destructive' \| 'outline'` | `'default'` |

---

### Input

```tsx
import { Input } from '@aspect/react-ui';

<Input placeholder="Search…" />
<Input type="email" required />
```

Extends all native `<input>` attributes.

---

### FormError

```tsx
import { FormError } from '@aspect/react-ui';

<FormError message="This field is required" />
<FormError />  {/* renders nothing when message is absent */}
```

| Prop | Type |
|---|---|
| `message` | `string \| undefined` |

---

### Stack

Flex layout primitive. Renders any HTML element.

```tsx
import { Stack } from '@aspect/react-ui';

// Vertical stack (default)
<Stack gap="lg">
  <Component />
  <Component />
</Stack>

// Horizontal row
<Stack direction="horizontal" align="center" justify="between">
  <Title />
  <Actions />
</Stack>

// Fills parent flex container
<Stack fill gap="sm">…</Stack>

// Renders as <section>
<Stack as="section" gap="md">…</Stack>
```

| Prop | Type | Default |
|---|---|---|
| `direction` | `'vertical' \| 'horizontal'` | `'vertical'` |
| `gap` | `'none' \| 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| '2xl'` | `'md'` |
| `align` | `'start' \| 'center' \| 'end' \| 'stretch'` | — |
| `justify` | `'start' \| 'center' \| 'end' \| 'between'` | — |
| `fill` | `boolean` | `false` |
| `as` | `ElementType` | `'div'` |

---

### PageLayout

Full-height shell with sticky header and footer slots.

```tsx
import { PageLayout, PageHeader } from '@aspect/react-ui';

<PageLayout
  header={<PageHeader title="Dashboard" />}
  footer={<Footer />}
>
  <main>…</main>
</PageLayout>
```

| Prop | Type |
|---|---|
| `header` | `ReactNode` |
| `footer` | `ReactNode` |
| `children` | `ReactNode` |

---

### PageHeader

```tsx
import { PageHeader } from '@aspect/react-ui';

<PageHeader
  title="Incidents"
  subtitle="Last 30 days"
  actions={<Button>New incident</Button>}
/>
```

| Prop | Type |
|---|---|
| `title` | `string` |
| `subtitle` | `string` |
| `actions` | `ReactNode` |

---

### TabNav / TabLink

Router-agnostic tab bar. Pass your router's `<Link>` via the `as` prop or use plain `<a>` tags.

```tsx
import { TabNav, TabLink } from '@aspect/react-ui';

<TabNav>
  <TabLink href="/overview" active>Overview</TabLink>
  <TabLink href="/events">Events</TabLink>
  <TabLink href="/settings">Settings</TabLink>
</TabNav>
```

`TabLink` extends all native `<a>` attributes plus `active: boolean`.

---

### DialogPanel

Modal dialog with backdrop.

```tsx
import { DialogPanel } from '@aspect/react-ui';

<DialogPanel title="Confirm deletion" onClose={() => setOpen(false)}>
  <p>This action cannot be undone.</p>
  <Button variant="destructive" onClick={handleDelete}>Delete</Button>
</DialogPanel>
```

---

### CollapsiblePanel

Expand/collapse container.

```tsx
import { CollapsiblePanel } from '@aspect/react-ui';

<CollapsiblePanel title="Advanced options">
  <Input placeholder="Custom value" />
</CollapsiblePanel>
```

---

### DataTable

Sortable, typed table built on TanStack Table.

```tsx
import { DataTable, type DataTableColumn } from '@aspect/react-ui';

const columns: DataTableColumn<User>[] = [
  { key: 'name',  header: 'Name',   cell: row => row.name },
  { key: 'email', header: 'Email',  cell: row => row.email },
  { key: 'role',  header: 'Role',   cell: row => <Badge>{row.role}</Badge> },
];

<DataTable data={users} columns={columns} />
```

---

### HistogramTimeline

Bar chart timeline for time-series data.

```tsx
import { HistogramTimeline, type HistogramBar } from '@aspect/react-ui';

const bars: HistogramBar[] = [
  { label: '00:00', value: 12 },
  { label: '06:00', value: 45 },
  { label: '12:00', value: 78 },
];

<HistogramTimeline bars={bars} variant="default" />
```

## Overriding styles

Add a stylesheet after the design system import and target the component's class name:

```css
@import "@aspect/design-system";

/* Pill-shaped buttons */
.btn { border-radius: var(--radius-full); }

/* Wider tab bar */
.tab-link { padding-inline: var(--spacing-lg); }
```

Unlayered CSS always beats `@layer components` — no `!important` needed.

## Peer dependencies

| Package | Version |
|---|---|
| `@aspect/design-system` | `^0.1.0` |
| `react` | `^19.0.0` |
| `react-dom` | `^19.0.0` |
