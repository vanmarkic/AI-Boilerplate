# @aspect/ui

Angular component library. Components handle structure and behaviour; all visual styling comes from [`@aspect/design-system`](../design-system/README.md).

## Installation

```sh
npm install @aspect/ui @aspect/design-system
```

Then load the design system CSS once at your app entry point:

```css
/* styles.css */
@import '@aspect/design-system';
```

## How it works

Each component emits semantic class names and `data-*` attributes. The design system CSS targets those to apply visual styles. This means:

- Components carry zero inline styles and no bundled CSS
- All theming and overrides happen in CSS, not in component inputs
- You can replace any component's look by overriding its class in your own stylesheet

## Components

### Button

```html
<button uiButton>Save</button>
<button uiButton variant="destructive">Delete</button>
<button uiButton variant="outline" size="sm">Cancel</button>
<button uiButton variant="ghost" disabled>Loading…</button>
```

| Input     | Type                                                 | Default     |
| --------- | ---------------------------------------------------- | ----------- |
| `variant` | `'default' \| 'destructive' \| 'outline' \| 'ghost'` | `'default'` |
| `size`    | `'sm' \| 'default' \| 'lg'`                          | `'default'` |

Works as a directive on `<button>` and `<a>` elements.

---

### Badge

```html
<ui-badge>Active</ui-badge>
<ui-badge variant="destructive">Error</ui-badge>
<ui-badge variant="outline">Draft</ui-badge>
```

| Input     | Type                                                     | Default     |
| --------- | -------------------------------------------------------- | ----------- |
| `variant` | `'default' \| 'secondary' \| 'destructive' \| 'outline'` | `'default'` |

---

### Input

```html
<ui-input label="Email" type="email" />
<ui-input placeholder="Search…" />
```

Implements `ControlValueAccessor` for reactive forms integration.

---

### FormError

```html
<ui-form-error [control]="form.controls.email" />
```

Displays validation errors (required, email, maxlength, minlength) when the control is touched.

---

### Stack

Flex layout primitive.

```html
<!-- Vertical stack (default) -->
<ui-stack gap="lg">
  <div>Item 1</div>
  <div>Item 2</div>
</ui-stack>

<!-- Horizontal row -->
<ui-stack direction="horizontal" align="center" justify="between">
  <h1>Title</h1>
  <button>Action</button>
</ui-stack>

<!-- Fills parent flex container -->
<ui-stack [fill]="true" gap="sm">…</ui-stack>
```

| Input       | Type                                                      | Default      |
| ----------- | --------------------------------------------------------- | ------------ |
| `direction` | `'vertical' \| 'horizontal'`                              | `'vertical'` |
| `gap`       | `'none' \| 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| '2xl'` | `'md'`       |
| `align`     | `'start' \| 'center' \| 'end' \| 'stretch'`               | —            |
| `justify`   | `'start' \| 'center' \| 'end' \| 'between'`               | —            |
| `fill`      | `boolean`                                                 | `false`      |

---

### Grid / Cell

CSS Grid layout with optional cell positioning.

```html
<ui-grid [cols]="3" gap="lg">
  <div uiCell [span]="2">Wide</div>
  <div uiCell>Normal</div>
  <div uiCell span="full">Full width</div>
</ui-grid>
```

**Grid inputs:**

| Input  | Type                                                      | Default |
| ------ | --------------------------------------------------------- | ------- |
| `cols` | `number \| string`                                        | —       |
| `gap`  | `'none' \| 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| '2xl'` | `'md'`  |
| `fill` | `boolean`                                                 | `false` |

**Cell inputs** (`uiCell` directive):

| Input     | Type                 | Default |
| --------- | -------------------- | ------- |
| `span`    | `number \| 'full'`   | —       |
| `start`   | `number`             | —       |
| `rowSpan` | `number`             | —       |

---

### PageLayout

Full-height shell with sticky header and footer slots.

```html
<ui-page-layout>
  <ui-page-header pageHeader title="Dashboard" />
  <main>…</main>
  <footer pageFooter>…</footer>
</ui-page-layout>
```

---

### PageHeader

```html
<ui-page-header title="Incidents" subtitle="Last 30 days">
  <button pageHeaderActions uiButton>New incident</button>
</ui-page-header>
```

| Input      | Type     |
| ---------- | -------- |
| `title`    | `string` |
| `subtitle` | `string` |

---

### TabNav / TabLink

Router-agnostic tab bar.

```html
<ui-tab-nav>
  <a uiTabLink routerLink="/overview" [active]="true">Overview</a>
  <a uiTabLink routerLink="/events">Events</a>
  <a uiTabLink routerLink="/settings">Settings</a>
</ui-tab-nav>
```

`TabLinkDirective` applies to `<a>` elements and adds `role="tab"` with `aria-selected` when active.

---

### DialogPanel

Modal dialog with backdrop.

```html
<ui-dialog-panel [variant]="'default'" (closed)="onClose()">
  <span dialogTitle>Confirm deletion</span>
  <p>This action cannot be undone.</p>
  <div dialogFooter>
    <button uiButton variant="destructive" (click)="handleDelete()">Delete</button>
  </div>
</ui-dialog-panel>
```

---

### CollapsiblePanel

Expand/collapse container with optional controlled mode.

```html
<ui-collapsible-panel [open]="isOpen" (openChange)="isOpen = $event">
  <span panelTitle>Advanced options</span>
  <ui-input placeholder="Custom value" />
</ui-collapsible-panel>
```

| Input       | Type                                    | Default     |
| ----------- | --------------------------------------- | ----------- |
| `variant`   | `'default' \| 'ghost' \| 'outline'`     | `'default'` |
| `size`      | `'sm' \| 'default' \| 'lg'`             | `'default'` |
| `open`      | `boolean`                               | `false`     |
| `disabled`  | `boolean`                               | `false`     |

| Output       | Type       |
| ------------ | ---------- |
| `openChange` | `boolean`  |

---

### DataTable

Sortable, typed table built on Angular CDK.

```html
<ui-data-table [dataSource]="users" [clickableRows]="true" (rowClick)="onRowClick($event)">
  <ui-data-table-column columnDef="name" label="Name" [sortable]="true" />
  <ui-data-table-column columnDef="email" label="Email" />
  <ui-data-table-column columnDef="role" label="Role">
    <ng-template #cell let-row>
      <ui-badge>{{ row.role }}</ui-badge>
    </ng-template>
  </ui-data-table-column>
</ui-data-table>
```

---

### HistogramTimeline

Bar chart timeline for time-series data.

```html
<ui-histogram-timeline [bars]="bars" variant="default" ariaLabel="Hourly traffic" />
```

## Overriding styles

Add a stylesheet after the design system import and target the component's class name:

```css
@import '@aspect/design-system';

/* Pill-shaped buttons */
.btn {
  border-radius: var(--radius-full);
}

/* Wider tab bar */
.tab-link {
  padding-inline: var(--spacing-lg);
}
```

Unlayered CSS always beats `@layer components` — no `!important` needed.

## Peer dependencies

| Package                 | Version    |
| ----------------------- | ---------- |
| `@aspect/design-system` | `*`        |
| `@angular/core`         | `^21.0.0`  |
| `@angular/forms`        | `^21.0.0`  |
| `@angular/cdk`          | `^21.0.0`  |
| `maplibre-gl`           | `^5.0.0`   |
