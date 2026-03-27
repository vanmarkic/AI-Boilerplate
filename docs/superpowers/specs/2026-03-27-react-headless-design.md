# @aspect/react-headless — Design Spec

**Date:** 2026-03-27
**Status:** Draft
**Package:** `packages/react-headless/`

## Summary

A custom headless UI primitive library for React 19, inspired by Radix UI's composable compound-component API and Base UI's single-package philosophy. Provides accessible, unstyled primitives that `@aspect/react-ui` wraps with `@aspect/design-system` CSS.

## Motivation

The existing `@aspect/react-ui` components hand-roll interaction behavior (DialogPanel, TabNav, CollapsiblePanel) and are missing critical accessibility features: focus trapping, scroll locking, keyboard navigation, and proper ARIA wiring. Rather than adding Radix as a dependency (maintenance uncertainty post-WorkOS acquisition, many small packages), we build a minimal set of primitives tailored to our needs.

## Architecture

### Approach: Hybrid (Compound Components + Hooks)

- **Primary API:** Radix-style compound components (`Dialog.Root`, `Dialog.Trigger`, `Dialog.Content`, etc.)
- **Escape hatch:** Exported hooks for advanced composition (`useFocusTrap`, `useRovingFocus`, etc.)
- **Single package:** All primitives ship in one tree-shakeable package (Base UI approach)
- **Zero styling:** No CSS, no design-system dependency. Consumers apply their own classes.

### Dependency Graph

```
@aspect/react-headless  (zero deps, peer: react ^19.0.0)
       ↑
@aspect/react-ui        (deps: react-headless, @tanstack/react-table)
       ↑
react-frontend app      (deps: react-ui, design-system)
```

## Package Structure

```
packages/react-headless/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── src/
│   ├── index.ts
│   ├── hooks/
│   │   ├── use-controllable-state.ts
│   │   ├── use-controllable-state.spec.ts
│   │   ├── use-focus-trap.ts
│   │   ├── use-focus-trap.spec.ts
│   │   ├── use-scroll-lock.ts
│   │   ├── use-scroll-lock.spec.ts
│   │   ├── use-roving-focus.ts
│   │   └── use-roving-focus.spec.ts
│   ├── utilities/
│   │   ├── portal.tsx
│   │   ├── portal.spec.tsx
│   │   ├── slot.tsx
│   │   └── slot.spec.tsx
│   ├── dialog/
│   │   ├── dialog.tsx
│   │   └── dialog.spec.tsx
│   ├── tabs/
│   │   ├── tabs.tsx
│   │   └── tabs.spec.tsx
│   ├── collapsible/
│   │   ├── collapsible.tsx
│   │   └── collapsible.spec.tsx
│   └── accordion/
│       ├── accordion.tsx
│       └── accordion.spec.tsx
├── e2e/
│   ├── fixtures/
│   │   └── test-app.tsx
│   ├── dialog.spec.ts
│   ├── tabs.spec.ts
│   ├── collapsible.spec.ts
│   └── accordion.spec.ts
```

## Public API

```ts
// Compound components (primary API)
export { Dialog } from './dialog/dialog';
export { Tabs } from './tabs/tabs';
export { Collapsible } from './collapsible/collapsible';
export { Accordion } from './accordion/accordion';

// Utilities
export { Portal } from './utilities/portal';
export { Slot } from './utilities/slot';

// Hooks (escape hatch)
export { useFocusTrap } from './hooks/use-focus-trap';
export { useScrollLock } from './hooks/use-scroll-lock';
export { useRovingFocus } from './hooks/use-roving-focus';
export { useControllableState } from './hooks/use-controllable-state';
```

## Hooks

### useControllableState\<T\>

Allows components to work in both controlled and uncontrolled modes.

```ts
interface UseControllableStateOptions<T> {
  value?: T;
  defaultValue: T;
  onChange?: (value: T) => void;
}
// Returns [currentValue, setValue]
```

Used by: all primitives.

### useFocusTrap

Traps keyboard focus inside a container element.

```ts
interface UseFocusTrapOptions {
  active: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  returnFocusOnDeactivate?: boolean; // default: true
}
function useFocusTrap(containerRef: RefObject<HTMLElement>, options: UseFocusTrapOptions): void;
```

**Behavior:**
- On activation: focuses first focusable element (or `initialFocusRef`)
- Tab on last focusable → wraps to first
- Shift+Tab on first focusable → wraps to last
- On deactivation: returns focus to previously focused element
- Uses MutationObserver to handle dynamically added/removed focusable elements
- Skips elements with `tabIndex={-1}`, `disabled`, `hidden`, `aria-hidden="true"`

Used by: Dialog. Future: Popover, Menu.

### useScrollLock

Prevents body scroll while a modal is open, without layout shift.

```ts
function useScrollLock(active: boolean): void;
```

**Behavior:**
- Sets `overflow: hidden` on `document.body`
- Compensates scrollbar width via `padding-right` to prevent layout jump
- Ref-counts nested activations (nested modals)
- Restores original styles on deactivation

Used by: Dialog.

### useRovingFocus

Arrow-key navigation within a group of focusable items.

```ts
interface UseRovingFocusOptions {
  orientation?: 'horizontal' | 'vertical'; // default: horizontal
  loop?: boolean;                          // default: true
}
interface RovingFocusReturn {
  getItemProps(index: number, disabled?: boolean): {
    ref: RefCallback<HTMLElement>;
    tabIndex: number;
    onKeyDown: KeyboardEventHandler;
    onFocus: FocusEventHandler;
  };
  focusedIndex: number;
}
```

**Behavior:**
- Active item has `tabIndex={0}`, all others `tabIndex={-1}`
- Arrow keys move focus (Left/Right horizontal, Up/Down vertical)
- Home/End jump to first/last
- Skips disabled items
- Loop wraps around (configurable)

Used by: Tabs, Accordion. Future: Menu, RadioGroup, Toolbar.

## Utilities

### Portal

```tsx
interface PortalProps {
  container?: HTMLElement; // default: document.body
  children: ReactNode;
}
```

Thin wrapper around `createPortal`. Used by Dialog to escape stacking contexts.

### Slot (asChild pattern)

Enables rendering as the child element instead of a default wrapper:

```tsx
<Dialog.Trigger asChild>
  <a href="#">Open as link</a>
</Dialog.Trigger>
```

**Merge rules:** event handlers — both fire; className — concatenated; refs — composed; styles — shallow merged; other props — child wins on conflict.

## Primitives

### Dialog

**Sub-components:**

| Component | Renders | Role |
|---|---|---|
| `Dialog.Root` | nothing (provider) | Manages open state |
| `Dialog.Trigger` | `<button>` | `aria-haspopup="dialog"`, `aria-expanded` |
| `Dialog.Portal` | Portal | Renders to `document.body` |
| `Dialog.Overlay` | `<div>` | Backdrop. Click closes (configurable). `aria-hidden="true"` |
| `Dialog.Content` | `<div>` | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby` |
| `Dialog.Title` | `<h2>` | Auto-ID, linked via `aria-labelledby` |
| `Dialog.Description` | `<p>` | Auto-ID, linked via `aria-describedby` |
| `Dialog.Close` | `<button>` | Calls `onOpenChange(false)` |

All sub-components support `asChild`.

**Props:**

```ts
interface DialogRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean; // default: true
}

interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
  onPointerDownOutside?: (e: PointerEvent) => void;
  onInteractOutside?: (e: Event) => void;
}
```

**Lifecycle:**
1. Open: Portal mounts → scroll lock activates → focus trap activates → focus moves to first focusable in Content
2. Close (Escape / overlay click / Close button): focus trap deactivates → scroll lock deactivates → focus returns to trigger → Portal unmounts

### Tabs

**Sub-components:**

| Component | Renders | Role |
|---|---|---|
| `Tabs.Root` | `<div>` | Manages active value, orientation |
| `Tabs.List` | `<div>` | `role="tablist"`, `aria-orientation` |
| `Tabs.Trigger` | `<button>` | `role="tab"`, `aria-selected`, `aria-controls` |
| `Tabs.Content` | `<div>` | `role="tabpanel"`, `aria-labelledby` |

Trigger and Content support `asChild`.

**Props:**

```ts
interface TabsRootProps extends HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical'; // default: horizontal
  activationMode?: 'automatic' | 'manual'; // default: automatic
}

interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  asChild?: boolean;
  disabled?: boolean;
}

interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  forceMount?: boolean;
}
```

**Keyboard (via useRovingFocus):**
- Arrow keys move focus between triggers
- Home/End jump to first/last
- Automatic mode: focus activates tab
- Manual mode: Enter/Space activates focused tab
- Disabled triggers are skipped

**ARIA wiring:** Auto-generated IDs link each Trigger↔Content pair via `aria-controls`/`aria-labelledby`.

### Collapsible

**Sub-components:**

| Component | Renders | Role |
|---|---|---|
| `Collapsible.Root` | `<div>` | Manages open state |
| `Collapsible.Trigger` | `<button>` | `aria-expanded`, `aria-controls` |
| `Collapsible.Content` | `<div>` | `role="region"`, `aria-labelledby`, hidden when closed |

**Props:**

```ts
interface CollapsibleRootProps extends HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}

interface CollapsibleContentProps extends HTMLAttributes<HTMLDivElement> {
  forceMount?: boolean;
}
```

**Behavior:**
- Trigger toggles open/closed state
- Content renders/unmounts based on open state (or stays mounted with `forceMount` for CSS animations)
- `data-state="open" | "closed"` on Root, Trigger, and Content for CSS animation hooks
- Disabled state prevents toggling

### Accordion

**Sub-components:**

| Component | Renders | Role |
|---|---|---|
| `Accordion.Root` | `<div>` | Manages which items are open, coordinates single/multiple mode |
| `Accordion.Item` | `<div>` | Wraps one trigger+content pair, holds its `value` |
| `Accordion.Trigger` | `<button>` | `aria-expanded`, `aria-controls` |
| `Accordion.Content` | `<div>` | `role="region"`, `aria-labelledby` |

**Props:**

```ts
// Single mode: one item open at a time
interface AccordionSingleProps extends HTMLAttributes<HTMLDivElement> {
  type: 'single';
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  collapsible?: boolean; // allow closing all items (default: false)
}

// Multiple mode: any number of items open
interface AccordionMultipleProps extends HTMLAttributes<HTMLDivElement> {
  type: 'multiple';
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
}

type AccordionRootProps = AccordionSingleProps | AccordionMultipleProps;

interface AccordionItemProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}

interface AccordionContentProps extends HTMLAttributes<HTMLDivElement> {
  forceMount?: boolean;
}
```

**Keyboard (via useRovingFocus, vertical orientation):**
- Up/Down arrow moves focus between triggers
- Home/End jump to first/last trigger
- Enter/Space toggles the focused item
- Disabled items are skipped

**State attributes:** `data-state="open" | "closed"` and `data-disabled` on all sub-components for CSS targeting.

## Testing Strategy

### Layer 1: Hooks — Vitest + renderHook

Fast, isolated unit tests. No DOM rendering overhead.

| Hook | Key test cases |
|---|---|
| `useControllableState` | Uncontrolled default works; controlled value overrides internal; onChange fires on setValue; does not fire onChange when controlled value changes externally |
| `useFocusTrap` | Tab wraps last→first; Shift+Tab wraps first→last; skips disabled/hidden/aria-hidden elements; returns focus on deactivate; handles dynamic DOM mutations via MutationObserver |
| `useScrollLock` | Sets body overflow hidden; compensates scrollbar width with padding-right; restores on deactivate; ref-counts nested activations |
| `useRovingFocus` | Arrow keys move focusedIndex; Home/End jump to first/last; skips disabled items; loop wraps around; only active item has tabIndex 0 |

### Layer 2: Components — Vitest + Testing Library

Validate ARIA attributes, prop forwarding, context wiring, rendering behavior.

| Primitive | Key test cases |
|---|---|
| Dialog | Trigger has `aria-haspopup`/`aria-expanded`; Content has `role="dialog"` + `aria-modal="true"`; Title/Description linked via `aria-labelledby`/`aria-describedby`; Close calls `onOpenChange(false)`; Escape fires `onEscapeKeyDown`; overlay click fires `onPointerDownOutside`; `asChild` merges props correctly; controlled + uncontrolled modes |
| Tabs | Triggers have `role="tab"` + `aria-selected`; List has `role="tablist"`; Content has `role="tabpanel"` + `aria-labelledby`; only active Content renders; `forceMount` renders inactive Content; disabled trigger gets `aria-disabled`; value change fires callback |
| Collapsible | Trigger has `aria-expanded`; Content has `role="region"`; `data-state` reflects open/closed; disabled prevents toggle; `forceMount` keeps Content mounted |
| Accordion | Single mode: opening one closes others; multiple mode: independent open/close; `collapsible` prop controls whether all can be closed; disabled items cannot toggle; correct ARIA on all sub-components |
| Portal | Renders children at `document.body`; custom container; cleans up on unmount |
| Slot | Merges className; composes refs; merges event handlers (both fire); child props win on conflict |

### Layer 3: Cross-Browser — Playwright (Chromium + Firefox)

Tests real browser behavior that jsdom cannot replicate. A minimal Vite React app in `e2e/fixtures/` mounts test scenarios.

**Playwright config:**
```ts
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
]
```

**Dialog e2e:**
- Focus moves into Content on open
- Tab cycles within Content (does not escape)
- Shift+Tab wraps from first→last focusable
- Escape closes dialog
- Click outside overlay closes dialog
- Focus returns to Trigger after close
- Body scroll locked while open (visual verification)
- No layout shift from scrollbar disappearing (padding compensation)
- Nested dialog: inner traps focus, closing inner returns focus to outer

**Tabs e2e:**
- Arrow keys move focus between triggers
- Home/End jump to first/last
- Automatic mode: arrow activates tab, correct panel displays
- Manual mode: arrow moves focus only, Enter/Space activates
- Disabled trigger skipped during navigation
- Tab key exits tablist (focus not trapped)
- Correct `aria-selected` state across browsers

**Collapsible e2e:**
- Click trigger toggles content visibility
- `data-state` attribute updates on open/close
- Keyboard: Enter/Space on trigger toggles
- Disabled collapsible does not toggle
- `forceMount`: content stays in DOM, `data-state` changes for CSS animation hooks

**Accordion e2e:**
- Single mode: opening item B closes item A
- Multiple mode: both A and B can be open
- `collapsible` single: clicking open item closes it
- Non-collapsible single: clicking open item does nothing
- Arrow key navigation between triggers (vertical)
- Home/End jump to first/last trigger
- Disabled items skipped in keyboard navigation

## react-ui Migration

### DialogPanel (non-breaking)

Public API unchanged: `variant`, `onClose`, `title`, `footer`, `children`.

```tsx
import { Dialog } from '@aspect/react-headless';

export function DialogPanel({ variant, onClose, title, footer, children }: DialogPanelProps) {
  return (
    <Dialog.Root open={true} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-backdrop" />
        <Dialog.Content className="dialog-panel" data-variant={variant}>
          {title && <Dialog.Title className="dialog-title">{title}</Dialog.Title>}
          <div className="dialog-body">{children}</div>
          {footer && <div className="dialog-footer">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

### TabNav / TabLink (minor breaking — 1 consumer)

New props: `TabNav` gains `value`/`onValueChange`; `TabLink` gains `value`, loses `active`.

```tsx
import { Tabs } from '@aspect/react-headless';

export function TabNav({ value, onValueChange, children }: TabNavProps) {
  return (
    <Tabs.Root value={value} onValueChange={onValueChange}>
      <Tabs.List className="tab-nav">{children}</Tabs.List>
    </Tabs.Root>
  );
}

export function TabLink({ value, href, children, ...props }: TabLinkProps) {
  return (
    <Tabs.Trigger value={value} asChild>
      <a href={href} className="tab-link" {...props}>{children}</a>
    </Tabs.Trigger>
  );
}
```

Consumer update required in `apps/main/react-frontend/src/features/admin/admin-layout.tsx` (only usage).

### CollapsiblePanel (non-breaking)

Public API unchanged: `variant`, `size`, `open`, `header`, `children`.

```tsx
import { Collapsible } from '@aspect/react-headless';

export function CollapsiblePanel({ variant, size, open, header, children }: CollapsiblePanelProps) {
  return (
    <Collapsible.Root defaultOpen={open}>
      <div className="collapsible-panel" data-variant={variant} data-size={size}>
        <Collapsible.Trigger asChild>
          <summary className="collapsible-panel-trigger">
            {header}
            <svg className="collapsible-panel-chevron" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </summary>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <div className="collapsible-panel-content">{children}</div>
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  );
}
```

### Design-system CSS addition

One addition to `packages/design-system/components-tabs.css`:

```css
.tab-link[aria-selected="true"] {
  /* same rules as .tab-active */
}
```

Allows headless tabs to drive active state via ARIA. Existing `.tab-active` stays for Angular backward compatibility.

## Hook Reuse Matrix

| Hook | Dialog | Tabs | Collapsible | Accordion | Future: Popover | Future: Menu |
|---|---|---|---|---|---|---|
| useControllableState | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| useFocusTrap | ✓ | | | | ✓ | ✓ |
| useScrollLock | ✓ | | | | | |
| useRovingFocus | | ✓ | | ✓ | | ✓ |

## Non-Goals

- No CSS or styling of any kind
- No animation logic (consumers use `data-state` + CSS transitions)
- No SSR support (not needed — frontend apps are SPAs)
- No replacement for `@tanstack/react-table` (it already follows the headless pattern)
- No barrel exports inside subdirectories (per project conventions)
