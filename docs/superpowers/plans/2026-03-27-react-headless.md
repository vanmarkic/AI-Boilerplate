# @aspect/react-headless Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a custom headless UI primitive library with Radix-style compound components, shared accessibility hooks, and cross-browser Playwright tests.

**Architecture:** Hybrid approach — compound component API for consumers, reusable hooks internally. Single tree-shakeable package `@aspect/react-headless` with zero styling. `@aspect/react-ui` wraps these primitives with `@aspect/design-system` CSS classes.

**Tech Stack:** React 19, TypeScript 5.9, Vite 6 (lib build), Vitest 4 (unit/component tests), Playwright (Chromium + Firefox e2e)

**Spec:** `docs/superpowers/specs/2026-03-27-react-headless-design.md`

---

## File Map

### New: `packages/react-headless/`

| File | Responsibility |
|---|---|
| `package.json` | Package metadata, peer deps, scripts |
| `tsconfig.json` | Strict TS config matching react-ui |
| `vite.config.ts` | ES lib build, externalize react |
| `vitest.config.ts` | jsdom, globals, test-setup |
| `playwright.config.ts` | Chromium + Firefox, Vite webServer |
| `src/test-setup.ts` | Import jest-dom matchers |
| `src/index.ts` | Public API barrel (library exception) |
| `src/hooks/use-controllable-state.ts` | Controlled/uncontrolled state hook |
| `src/hooks/use-controllable-state.spec.ts` | Hook unit tests |
| `src/hooks/use-focus-trap.ts` | Focus trap with MutationObserver |
| `src/hooks/use-focus-trap.spec.ts` | Hook unit tests |
| `src/hooks/use-scroll-lock.ts` | Body scroll lock with ref-counting |
| `src/hooks/use-scroll-lock.spec.ts` | Hook unit tests |
| `src/hooks/use-roving-focus.ts` | Arrow-key roving tabindex |
| `src/hooks/use-roving-focus.spec.ts` | Hook unit tests |
| `src/utilities/portal.tsx` | createPortal wrapper |
| `src/utilities/portal.spec.tsx` | Portal tests |
| `src/utilities/slot.tsx` | asChild prop merging |
| `src/utilities/slot.spec.tsx` | Slot merge tests |
| `src/dialog/dialog.tsx` | Dialog compound component (8 sub-components) |
| `src/dialog/dialog.spec.tsx` | Dialog component tests |
| `src/tabs/tabs.tsx` | Tabs compound component (4 sub-components) |
| `src/tabs/tabs.spec.tsx` | Tabs component tests |
| `src/collapsible/collapsible.tsx` | Collapsible compound component (3 sub-components) |
| `src/collapsible/collapsible.spec.tsx` | Collapsible component tests |
| `src/accordion/accordion.tsx` | Accordion compound component (5 sub-components) |
| `src/accordion/accordion.spec.tsx` | Accordion component tests |
| `e2e/fixtures/test-app.tsx` | Minimal React app for Playwright |
| `e2e/fixtures/main.tsx` | Vite entry point for e2e app |
| `e2e/fixtures/index.html` | HTML shell for e2e app |
| `e2e/fixtures/vite.config.ts` | Vite config for e2e fixture app |
| `e2e/dialog.spec.ts` | Dialog cross-browser e2e |
| `e2e/tabs.spec.ts` | Tabs cross-browser e2e |
| `e2e/collapsible.spec.ts` | Collapsible cross-browser e2e |
| `e2e/accordion.spec.ts` | Accordion cross-browser e2e |

### Modified

| File | Change |
|---|---|
| `packages/react-ui/package.json` | Add `@aspect/react-headless` dependency |
| `packages/react-ui/src/dialog-panel.tsx` | Rewrite internals to use `Dialog.*` |
| `packages/react-ui/src/dialog-panel.spec.tsx` | Update tests for new internals |
| `packages/react-ui/src/tab-nav.tsx` | Rewrite to use `Tabs.*`, new props |
| `packages/react-ui/src/tab-nav.spec.tsx` | Update tests for new API |
| `packages/react-ui/src/collapsible-panel.tsx` | Rewrite to use `Collapsible.*` |
| `packages/react-ui/src/collapsible-panel.spec.tsx` | Update tests for new internals |
| `packages/react-ui/src/index.ts` | Update CollapsiblePanel type exports |
| `packages/design-system/components-tabs.css` | Add `[aria-selected="true"]` rule |
| `packages/design-system/components-panels.css` | `[open]` → `[data-state="open"]`, remove marker rules |
| `apps/main/react-frontend/src/features/admin/admin-layout.tsx` | Migrate to TabLink with value props |

---

## Task 1: Package Scaffolding

**Files:**
- Create: `packages/react-headless/package.json`
- Create: `packages/react-headless/tsconfig.json`
- Create: `packages/react-headless/vite.config.ts`
- Create: `packages/react-headless/vitest.config.ts`
- Create: `packages/react-headless/src/test-setup.ts`
- Create: `packages/react-headless/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@aspect/react-headless",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ci": "vitest run --reporter=default",
    "e2e": "playwright test",
    "e2e:headed": "playwright test --headed"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.58.2",
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

Identical to `packages/react-ui/tsconfig.json`:

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

- [ ] **Step 5: Create test-setup.ts and empty index.ts**

`src/test-setup.ts`:
```typescript
import '@testing-library/jest-dom/vitest';
```

`src/index.ts`:
```typescript
// Public API — populated as primitives are implemented
```

- [ ] **Step 6: Install dependencies**

Run: `cd packages/react-headless && npm install`
Expected: `node_modules` created, no errors

- [ ] **Step 7: Verify build and test commands work**

Run: `cd packages/react-headless && npx vitest run`
Expected: "No test files found" (no tests yet, but no config errors)

- [ ] **Step 8: Commit**

```bash
git add packages/react-headless/
git commit -m "feat(react-headless): scaffold package with build and test config"
```

---

## Task 2: useControllableState Hook

**Files:**
- Create: `packages/react-headless/src/hooks/use-controllable-state.ts`
- Create: `packages/react-headless/src/hooks/use-controllable-state.spec.ts`
- Modify: `packages/react-headless/src/index.ts`

- [ ] **Step 1: Write failing tests**

`src/hooks/use-controllable-state.spec.ts`:
```typescript
import { renderHook, act } from '@testing-library/react';
import { useControllableState } from './use-controllable-state';

describe('useControllableState', () => {
  it('returns defaultValue in uncontrolled mode', () => {
    const { result } = renderHook(() =>
      useControllableState({ defaultValue: 'hello' }),
    );
    expect(result.current[0]).toBe('hello');
  });

  it('updates internal state in uncontrolled mode', () => {
    const { result } = renderHook(() =>
      useControllableState({ defaultValue: 0 }),
    );
    act(() => result.current[1](5));
    expect(result.current[0]).toBe(5);
  });

  it('calls onChange in uncontrolled mode', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useControllableState({ defaultValue: 0, onChange }),
    );
    act(() => result.current[1](5));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('uses controlled value over internal state', () => {
    const { result } = renderHook(() =>
      useControllableState({ value: 'controlled', defaultValue: 'default' }),
    );
    expect(result.current[0]).toBe('controlled');
  });

  it('calls onChange but does not update internal state in controlled mode', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useControllableState({ value: 'controlled', defaultValue: 'default', onChange }),
    );
    act(() => result.current[1]('new'));
    expect(onChange).toHaveBeenCalledWith('new');
    expect(result.current[0]).toBe('controlled');
  });

  it('does not fire onChange when controlled value changes externally', () => {
    const onChange = vi.fn();
    const { rerender } = renderHook(
      ({ value }) => useControllableState({ value, defaultValue: 'a', onChange }),
      { initialProps: { value: 'a' } },
    );
    rerender({ value: 'b' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('warns when switching from uncontrolled to controlled', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = renderHook(
      ({ value }: { value?: string }) =>
        useControllableState({ value, defaultValue: 'a' }),
      { initialProps: { value: undefined } },
    );
    rerender({ value: 'controlled' });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('uncontrolled to controlled'),
    );
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/react-headless && npx vitest run src/hooks/use-controllable-state.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the hook**

`src/hooks/use-controllable-state.ts`:
```typescript
import { useCallback, useRef, useState } from 'react';

export interface UseControllableStateOptions<T> {
  value?: T;
  defaultValue: T;
  onChange?: (value: T) => void;
}

export function useControllableState<T>(
  options: UseControllableStateOptions<T>,
): [T, (value: T) => void] {
  const { value: controlledValue, defaultValue, onChange } = options;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const wasControlledRef = useRef(isControlled);

  if (process.env.NODE_ENV !== 'production') {
    if (wasControlledRef.current && !isControlled) {
      console.warn(
        'A component changed from controlled to uncontrolled. This is not supported.',
      );
    }
    if (!wasControlledRef.current && isControlled) {
      console.warn(
        'A component changed from uncontrolled to controlled. This is not supported.',
      );
    }
  }
  wasControlledRef.current = isControlled;

  const currentValue = isControlled ? controlledValue : internalValue;

  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) {
        setInternalValue(next);
      }
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  return [currentValue, setValue];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/react-headless && npx vitest run src/hooks/use-controllable-state.spec.ts`
Expected: 7 tests PASS

- [ ] **Step 5: Export from index.ts**

Add to `src/index.ts`:
```typescript
export { useControllableState, type UseControllableStateOptions } from './hooks/use-controllable-state';
```

- [ ] **Step 6: Commit**

```bash
git add packages/react-headless/src/hooks/use-controllable-state.ts packages/react-headless/src/hooks/use-controllable-state.spec.ts packages/react-headless/src/index.ts
git commit -m "feat(react-headless): add useControllableState hook"
```

---

## Task 3: useScrollLock Hook

**Files:**
- Create: `packages/react-headless/src/hooks/use-scroll-lock.ts`
- Create: `packages/react-headless/src/hooks/use-scroll-lock.spec.ts`
- Modify: `packages/react-headless/src/index.ts`

- [ ] **Step 1: Write failing tests**

`src/hooks/use-scroll-lock.spec.ts`:
```typescript
import { renderHook } from '@testing-library/react';
import { useScrollLock } from './use-scroll-lock';

describe('useScrollLock', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  });

  it('sets overflow hidden when active', () => {
    renderHook(() => useScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('does not set overflow hidden when inactive', () => {
    renderHook(() => useScrollLock(false));
    expect(document.body.style.overflow).toBe('');
  });

  it('restores overflow on deactivation', () => {
    const { rerender } = renderHook(
      ({ active }) => useScrollLock(active),
      { initialProps: { active: true } },
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender({ active: false });
    expect(document.body.style.overflow).toBe('');
  });

  it('restores overflow on unmount', () => {
    const { unmount } = renderHook(() => useScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('ref-counts nested activations', () => {
    const hook1 = renderHook(() => useScrollLock(true));
    const hook2 = renderHook(() => useScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
    hook1.unmount();
    expect(document.body.style.overflow).toBe('hidden');
    hook2.unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('compensates scrollbar width with padding-right', () => {
    // jsdom has 0 scrollbar width, so padding-right should be '0px'
    renderHook(() => useScrollLock(true));
    expect(document.body.style.paddingRight).toBe('0px');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/react-headless && npx vitest run src/hooks/use-scroll-lock.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement the hook**

`src/hooks/use-scroll-lock.ts`:
```typescript
import { useEffect } from 'react';

let lockCount = 0;
let originalOverflow = '';
let originalPaddingRight = '';

function lock() {
  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow;
    originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  lockCount++;
}

function unlock() {
  lockCount--;
  if (lockCount === 0) {
    document.body.style.overflow = originalOverflow;
    document.body.style.paddingRight = originalPaddingRight;
  }
}

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lock();
    return () => unlock();
  }, [active]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/react-headless && npx vitest run src/hooks/use-scroll-lock.spec.ts`
Expected: 6 tests PASS

- [ ] **Step 5: Export from index.ts**

Add to `src/index.ts`:
```typescript
export { useScrollLock } from './hooks/use-scroll-lock';
```

- [ ] **Step 6: Commit**

```bash
git add packages/react-headless/src/hooks/use-scroll-lock.ts packages/react-headless/src/hooks/use-scroll-lock.spec.ts packages/react-headless/src/index.ts
git commit -m "feat(react-headless): add useScrollLock hook with ref-counting"
```

---

## Task 4: useFocusTrap Hook

**Files:**
- Create: `packages/react-headless/src/hooks/use-focus-trap.ts`
- Create: `packages/react-headless/src/hooks/use-focus-trap.spec.ts`
- Modify: `packages/react-headless/src/index.ts`

- [ ] **Step 1: Write failing tests**

`src/hooks/use-focus-trap.spec.ts`:
```typescript
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useFocusTrap } from './use-focus-trap';

function createContainer(...focusableElements: string[]): HTMLDivElement {
  const container = document.createElement('div');
  for (const tag of focusableElements) {
    container.appendChild(document.createElement(tag));
  }
  document.body.appendChild(container);
  return container;
}

function useRefWith<T>(value: T) {
  const ref = useRef<T>(value);
  ref.current = value;
  return ref;
}

describe('useFocusTrap', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('focuses first focusable element on activation', () => {
    const container = createContainer('button', 'input');
    renderHook(() => {
      const ref = useRefWith(container);
      useFocusTrap(ref, { active: true });
    });
    expect(document.activeElement).toBe(container.querySelector('button'));
  });

  it('does not trap focus when inactive', () => {
    const container = createContainer('button');
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    renderHook(() => {
      const ref = useRefWith(container);
      useFocusTrap(ref, { active: false });
    });
    expect(document.activeElement).toBe(outside);
  });

  it('falls back to container when no focusable elements', () => {
    const container = createContainer();
    renderHook(() => {
      const ref = useRefWith(container);
      useFocusTrap(ref, { active: true });
    });
    expect(document.activeElement).toBe(container);
    expect(container.tabIndex).toBe(-1);
  });

  it('skips disabled elements', () => {
    const container = createContainer('button', 'button');
    const buttons = container.querySelectorAll('button');
    (buttons[0] as HTMLButtonElement).disabled = true;
    renderHook(() => {
      const ref = useRefWith(container);
      useFocusTrap(ref, { active: true });
    });
    expect(document.activeElement).toBe(buttons[1]);
  });

  it('skips elements with aria-hidden', () => {
    const container = createContainer('button', 'button');
    const buttons = container.querySelectorAll('button');
    buttons[0].setAttribute('aria-hidden', 'true');
    renderHook(() => {
      const ref = useRefWith(container);
      useFocusTrap(ref, { active: true });
    });
    expect(document.activeElement).toBe(buttons[1]);
  });

  it('returns focus to previously focused element on deactivation', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    const container = createContainer('button');
    const { rerender } = renderHook(
      ({ active }) => {
        const ref = useRefWith(container);
        useFocusTrap(ref, { active });
      },
      { initialProps: { active: true } },
    );
    expect(document.activeElement).toBe(container.querySelector('button'));
    rerender({ active: false });
    expect(document.activeElement).toBe(outside);
  });

  it('Tab on last focusable wraps to first', () => {
    const container = createContainer('button', 'input', 'button');
    const elements = Array.from(container.querySelectorAll('button, input'));
    renderHook(() => {
      const ref = useRefWith(container);
      useFocusTrap(ref, { active: true });
    });
    // Focus last element
    (elements[2] as HTMLElement).focus();
    // Press Tab — should wrap to first
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    const prevented = !document.dispatchEvent(event);
    // Focus should move to first (or event should be prevented for wrapping)
    expect(document.activeElement).toBe(elements[0]);
  });

  it('Shift+Tab on first focusable wraps to last', () => {
    const container = createContainer('button', 'input', 'button');
    const elements = Array.from(container.querySelectorAll('button, input'));
    renderHook(() => {
      const ref = useRefWith(container);
      useFocusTrap(ref, { active: true });
    });
    // Focus first element
    (elements[0] as HTMLElement).focus();
    // Press Shift+Tab — should wrap to last
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
    expect(document.activeElement).toBe(elements[2]);
  });

  it('handles dynamically added focusable elements', async () => {
    const container = createContainer('button');
    renderHook(() => {
      const ref = useRefWith(container);
      useFocusTrap(ref, { active: true });
    });
    // Dynamically add a new button
    const newBtn = document.createElement('button');
    newBtn.textContent = 'Dynamic';
    container.appendChild(newBtn);
    // MutationObserver fires async — wait a tick
    await new Promise((r) => setTimeout(r, 0));
    // Focus the first button, Tab should now reach the new button
    (container.querySelector('button') as HTMLElement).focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    document.dispatchEvent(event);
    // The new button should be reachable (not trapped on old single-element list)
    expect(document.activeElement).toBe(newBtn);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/react-headless && npx vitest run src/hooks/use-focus-trap.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement the hook**

`src/hooks/use-focus-trap.ts`:
```typescript
import { type RefObject, useEffect, useRef } from 'react';

export interface UseFocusTrapOptions {
  active: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  returnFocusOnDeactivate?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
  return elements.filter(
    (el) =>
      !el.hasAttribute('disabled') &&
      !el.closest('[aria-hidden="true"]') &&
      !el.hasAttribute('hidden') &&
      el.tabIndex !== -1,
  );
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  options: UseFocusTrapOptions,
): void {
  const { active, initialFocusRef, returnFocusOnDeactivate = true } = options;
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const focusableElements = getFocusableElements(container);
    const initialFocus = initialFocusRef?.current;

    if (initialFocus && !initialFocus.hasAttribute('disabled') && !initialFocus.hasAttribute('hidden')) {
      initialFocus.focus();
    } else if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      container.tabIndex = -1;
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const currentFocusable = getFocusableElements(container);
      if (currentFocusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const observer = new MutationObserver(() => {
      // Re-query focusable elements on DOM mutations — the keydown
      // handler already calls getFocusableElements dynamically
    });
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'hidden', 'aria-hidden', 'tabindex'],
    });

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      observer.disconnect();
      if (returnFocusOnDeactivate && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [active, containerRef, initialFocusRef, returnFocusOnDeactivate]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/react-headless && npx vitest run src/hooks/use-focus-trap.spec.ts`
Expected: 10 tests PASS

- [ ] **Step 5: Export from index.ts**

Add to `src/index.ts`:
```typescript
export { useFocusTrap, type UseFocusTrapOptions } from './hooks/use-focus-trap';
```

- [ ] **Step 6: Commit**

```bash
git add packages/react-headless/src/hooks/use-focus-trap.ts packages/react-headless/src/hooks/use-focus-trap.spec.ts packages/react-headless/src/index.ts
git commit -m "feat(react-headless): add useFocusTrap hook with MutationObserver"
```

---

## Task 5: useRovingFocus Hook

**Files:**
- Create: `packages/react-headless/src/hooks/use-roving-focus.ts`
- Create: `packages/react-headless/src/hooks/use-roving-focus.spec.ts`
- Modify: `packages/react-headless/src/index.ts`

- [ ] **Step 1: Write failing tests**

`src/hooks/use-roving-focus.spec.ts`:
```typescript
import { renderHook, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { useRovingFocus } from './use-roving-focus';

function setupItems(hook: { current: ReturnType<typeof useRovingFocus> }, count: number) {
  const items: HTMLButtonElement[] = [];
  for (let i = 0; i < count; i++) {
    const btn = document.createElement('button');
    btn.textContent = `Item ${i}`;
    document.body.appendChild(btn);
    const props = hook.current.getItemProps(i);
    btn.tabIndex = props.tabIndex;
    btn.addEventListener('keydown', props.onKeyDown as EventListener);
    btn.addEventListener('focus', props.onFocus as EventListener);
    if (typeof props.ref === 'function') props.ref(btn);
    items.push(btn);
  }
  return items;
}

describe('useRovingFocus', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('sets tabIndex 0 on first item, -1 on rest', () => {
    const { result } = renderHook(() => useRovingFocus({}));
    expect(result.current.getItemProps(0).tabIndex).toBe(0);
    expect(result.current.getItemProps(1).tabIndex).toBe(-1);
    expect(result.current.getItemProps(2).tabIndex).toBe(-1);
  });

  it('starts focusedIndex at 0', () => {
    const { result } = renderHook(() => useRovingFocus({}));
    expect(result.current.focusedIndex).toBe(0);
  });

  it('ArrowRight moves focus forward (horizontal)', () => {
    const { result } = renderHook(() =>
      useRovingFocus({ orientation: 'horizontal' }),
    );
    const items = setupItems(result, 3);
    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'ArrowRight' });
    expect(result.current.focusedIndex).toBe(1);
  });

  it('ArrowDown moves focus forward (vertical)', () => {
    const { result } = renderHook(() =>
      useRovingFocus({ orientation: 'vertical' }),
    );
    const items = setupItems(result, 3);
    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(result.current.focusedIndex).toBe(1);
  });

  it('Home jumps to first item', () => {
    const { result } = renderHook(() => useRovingFocus({}));
    const items = setupItems(result, 3);
    items[2].focus();
    act(() => { result.current.getItemProps(2).onFocus({} as React.FocusEvent); });
    fireEvent.keyDown(items[2], { key: 'Home' });
    expect(result.current.focusedIndex).toBe(0);
  });

  it('End jumps to last item', () => {
    const { result } = renderHook(() => useRovingFocus({}));
    const items = setupItems(result, 3);
    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'End' });
    expect(result.current.focusedIndex).toBe(2);
  });

  it('loops from last to first', () => {
    const { result } = renderHook(() =>
      useRovingFocus({ loop: true }),
    );
    const items = setupItems(result, 3);
    items[2].focus();
    act(() => { result.current.getItemProps(2).onFocus({} as React.FocusEvent); });
    fireEvent.keyDown(items[2], { key: 'ArrowRight' });
    expect(result.current.focusedIndex).toBe(0);
  });

  it('skips disabled items', () => {
    const { result } = renderHook(() => useRovingFocus({}));
    // Item 1 is disabled
    expect(result.current.getItemProps(1, true).tabIndex).toBe(-1);
    const items = setupItems(result, 3);
    items[0].focus();
    // Override getItemProps to mark item 1 as disabled
    const propsDisabled = result.current.getItemProps(1, true);
    items[1].tabIndex = propsDisabled.tabIndex;
    fireEvent.keyDown(items[0], { key: 'ArrowRight' });
    expect(result.current.focusedIndex).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/react-headless && npx vitest run src/hooks/use-roving-focus.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement the hook**

**Implementation note:** The `getItemProps` function must NOT perform side effects (like mutating `disabledRef`) during render. Track disabled state via the `ref` callback (items register/deregister on mount/unmount) or via a separate `useEffect`. The `onKeyDown` handler must read `focusedIndex` from a ref (not a closure) to avoid stale state after re-renders.

`src/hooks/use-roving-focus.ts`:
```typescript
import {
  useCallback,
  useRef,
  useState,
  type FocusEventHandler,
  type KeyboardEventHandler,
  type RefCallback,
} from 'react';

export interface UseRovingFocusOptions {
  orientation?: 'horizontal' | 'vertical';
  loop?: boolean;
}

export interface RovingFocusReturn {
  getItemProps(
    index: number,
    disabled?: boolean,
  ): {
    ref: RefCallback<HTMLElement>;
    tabIndex: number;
    onKeyDown: KeyboardEventHandler;
    onFocus: FocusEventHandler;
  };
  focusedIndex: number;
}

export function useRovingFocus(
  options: UseRovingFocusOptions = {},
): RovingFocusReturn {
  const { orientation = 'horizontal', loop = true } = options;
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemsRef = useRef<Map<number, HTMLElement>>(new Map());
  const disabledRef = useRef<Set<number>>(new Set());

  const focusItem = useCallback((index: number) => {
    const el = itemsRef.current.get(index);
    if (el) {
      el.focus();
      setFocusedIndex(index);
    }
  }, []);

  const findNext = useCallback(
    (from: number, direction: 1 | -1): number | null => {
      const size = itemsRef.current.size;
      if (size === 0) return null;
      let candidate = from + direction;
      const maxSteps = size;
      for (let step = 0; step < maxSteps; step++) {
        if (candidate < 0) candidate = loop ? size - 1 : 0;
        if (candidate >= size) candidate = loop ? 0 : size - 1;
        if (!disabledRef.current.has(candidate)) return candidate;
        candidate += direction;
      }
      return null;
    },
    [loop],
  );

  const getItemProps = useCallback(
    (
      index: number,
      disabled = false,
    ): {
      ref: RefCallback<HTMLElement>;
      tabIndex: number;
      onKeyDown: KeyboardEventHandler;
      onFocus: FocusEventHandler;
    } => {
      if (disabled) {
        disabledRef.current.add(index);
      } else {
        disabledRef.current.delete(index);
      }

      return {
        ref: (el: HTMLElement | null) => {
          if (el) {
            itemsRef.current.set(index, el);
          } else {
            itemsRef.current.delete(index);
          }
        },
        tabIndex: index === focusedIndex && !disabled ? 0 : -1,
        onKeyDown: (e) => {
          const forwardKey =
            orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
          const backKey =
            orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';

          let nextIndex: number | null = null;

          switch (e.key) {
            case forwardKey:
              nextIndex = findNext(focusedIndex, 1);
              break;
            case backKey:
              nextIndex = findNext(focusedIndex, -1);
              break;
            case 'Home':
              nextIndex = findNext(-1, 1);
              break;
            case 'End':
              nextIndex = findNext(itemsRef.current.size, -1);
              break;
            default:
              return;
          }

          if (nextIndex !== null) {
            e.preventDefault();
            focusItem(nextIndex);
          }
        },
        onFocus: () => {
          setFocusedIndex(index);
        },
      };
    },
    [focusedIndex, orientation, findNext, focusItem],
  );

  return { getItemProps, focusedIndex };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/react-headless && npx vitest run src/hooks/use-roving-focus.spec.ts`
Expected: 8 tests PASS

- [ ] **Step 5: Export from index.ts**

Add to `src/index.ts`:
```typescript
export { useRovingFocus, type UseRovingFocusOptions, type RovingFocusReturn } from './hooks/use-roving-focus';
```

- [ ] **Step 6: Commit**

```bash
git add packages/react-headless/src/hooks/use-roving-focus.ts packages/react-headless/src/hooks/use-roving-focus.spec.ts packages/react-headless/src/index.ts
git commit -m "feat(react-headless): add useRovingFocus hook with arrow key navigation"
```

---

## Task 6: Portal and Slot Utilities

**Files:**
- Create: `packages/react-headless/src/utilities/portal.tsx`
- Create: `packages/react-headless/src/utilities/portal.spec.tsx`
- Create: `packages/react-headless/src/utilities/slot.tsx`
- Create: `packages/react-headless/src/utilities/slot.spec.tsx`
- Modify: `packages/react-headless/src/index.ts`

- [ ] **Step 1: Write Portal tests**

`src/utilities/portal.spec.tsx`:
```typescript
import { render, screen } from '@testing-library/react';
import { Portal } from './portal';

describe('Portal', () => {
  it('renders children at document.body', () => {
    const { container } = render(
      <div data-testid="parent">
        <Portal>
          <span data-testid="child">Hello</span>
        </Portal>
      </div>,
    );
    // Child should NOT be inside parent container
    expect(container.querySelector('[data-testid="child"]')).toBeNull();
    // But should exist in body
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders into custom container', () => {
    const custom = document.createElement('div');
    document.body.appendChild(custom);
    render(
      <Portal container={custom}>
        <span data-testid="custom-child">Custom</span>
      </Portal>,
    );
    expect(custom.querySelector('[data-testid="custom-child"]')).not.toBeNull();
    document.body.removeChild(custom);
  });

  it('cleans up on unmount', () => {
    const { unmount } = render(
      <Portal>
        <span data-testid="ephemeral">Gone</span>
      </Portal>,
    );
    expect(screen.getByTestId('ephemeral')).toBeInTheDocument();
    unmount();
    expect(screen.queryByTestId('ephemeral')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement Portal**

`src/utilities/portal.tsx`:
```typescript
import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface PortalProps {
  container?: HTMLElement;
  children: ReactNode;
}

export function Portal({ container, children }: PortalProps) {
  const target = container ?? (typeof document !== 'undefined' ? document.body : null);
  if (!target) return null;
  return createPortal(children, target);
}
```

- [ ] **Step 3: Run Portal tests**

Run: `cd packages/react-headless && npx vitest run src/utilities/portal.spec.tsx`
Expected: 3 tests PASS

- [ ] **Step 4: Write Slot tests**

`src/utilities/slot.spec.tsx`:
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { Slot } from './slot';

describe('Slot', () => {
  it('renders child element with merged props', () => {
    render(
      <Slot data-testid="slot" className="from-slot">
        <button className="from-child">Click</button>
      </Slot>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('from-slot', 'from-child');
    expect(btn).toHaveAttribute('data-testid', 'slot');
  });

  it('merges event handlers — both fire', async () => {
    const slotClick = vi.fn();
    const childClick = vi.fn();
    render(
      <Slot onClick={slotClick}>
        <button onClick={childClick}>Click</button>
      </Slot>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(slotClick).toHaveBeenCalledOnce();
    expect(childClick).toHaveBeenCalledOnce();
  });

  it('composes refs', () => {
    const slotRef = createRef<HTMLButtonElement>();
    const childRef = createRef<HTMLButtonElement>();
    render(
      <Slot ref={slotRef}>
        <button ref={childRef}>Click</button>
      </Slot>,
    );
    expect(slotRef.current).toBe(childRef.current);
    expect(slotRef.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('child props win on conflict', () => {
    render(
      <Slot id="slot-id" data-value="slot">
        <button id="child-id" data-value="child">
          Click
        </button>
      </Slot>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('id', 'child-id');
    expect(btn).toHaveAttribute('data-value', 'child');
  });

  it('merges styles with child winning', () => {
    render(
      <Slot style={{ color: 'red', fontSize: '12px' }}>
        <div style={{ color: 'blue' }} data-testid="styled">
          Content
        </div>
      </Slot>,
    );
    const el = screen.getByTestId('styled');
    expect(el.style.color).toBe('blue');
    expect(el.style.fontSize).toBe('12px');
  });
});
```

- [ ] **Step 5: Implement Slot**

`src/utilities/slot.tsx`:
```typescript
import {
  cloneElement,
  isValidElement,
  type ReactNode,
  type Ref,
  type HTMLAttributes,
  type CSSProperties,
} from 'react';

export interface SlotProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
}

function composeRefs<T>(...refs: (Ref<T> | undefined)[]): Ref<T> {
  return (instance: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') {
        ref(instance);
      } else if (ref && typeof ref === 'object') {
        (ref as { current: T | null }).current = instance;
      }
    }
  };
}

function composeEventHandlers(
  slotHandler?: (...args: unknown[]) => void,
  childHandler?: (...args: unknown[]) => void,
): ((...args: unknown[]) => void) | undefined {
  if (!slotHandler && !childHandler) return undefined;
  return (...args: unknown[]) => {
    slotHandler?.(...args);
    childHandler?.(...args);
  };
}

export function Slot({ children, ref: slotRef, ...slotProps }: SlotProps) {
  if (!isValidElement(children)) {
    return children ?? null;
  }

  const childProps = children.props as Record<string, unknown>;
  const mergedProps: Record<string, unknown> = { ...slotProps };

  // Merge classNames
  const slotClass = slotProps.className;
  const childClass = childProps['className'] as string | undefined;
  if (slotClass || childClass) {
    mergedProps['className'] = [slotClass, childClass].filter(Boolean).join(' ');
  }

  // Merge styles (child wins)
  const slotStyle = slotProps.style as CSSProperties | undefined;
  const childStyle = childProps['style'] as CSSProperties | undefined;
  if (slotStyle || childStyle) {
    mergedProps['style'] = { ...slotStyle, ...childStyle };
  }

  // Merge event handlers
  for (const key of Object.keys(slotProps)) {
    if (
      key.startsWith('on') &&
      typeof (slotProps as Record<string, unknown>)[key] === 'function'
    ) {
      mergedProps[key] = composeEventHandlers(
        (slotProps as Record<string, unknown>)[key] as (...args: unknown[]) => void,
        childProps[key] as ((...args: unknown[]) => void) | undefined,
      );
    }
  }

  // Child props win for everything else
  for (const key of Object.keys(childProps)) {
    if (key === 'className' || key === 'style' || key === 'ref') continue;
    if (key.startsWith('on') && mergedProps[key]) continue;
    mergedProps[key] = childProps[key];
  }

  // Compose refs — React 19 uses ref-as-prop (on children.props, not children.ref)
  const childRef = childProps['ref'] as Ref<HTMLElement> | undefined;
  mergedProps['ref'] = composeRefs(slotRef, childRef);

  return cloneElement(children, mergedProps);
}
```

- [ ] **Step 6: Run all utility tests**

Run: `cd packages/react-headless && npx vitest run src/utilities/`
Expected: 8 tests PASS (3 Portal + 5 Slot)

- [ ] **Step 7: Export from index.ts**

Add to `src/index.ts`:
```typescript
export { Portal, type PortalProps } from './utilities/portal';
export { Slot, type SlotProps } from './utilities/slot';
```

- [ ] **Step 8: Commit**

```bash
git add packages/react-headless/src/utilities/ packages/react-headless/src/index.ts
git commit -m "feat(react-headless): add Portal and Slot utilities"
```

---

## Task 7: Collapsible Primitive

**Files:**
- Create: `packages/react-headless/src/collapsible/collapsible.tsx`
- Create: `packages/react-headless/src/collapsible/collapsible.spec.tsx`
- Modify: `packages/react-headless/src/index.ts`

**Why Collapsible first:** It's the simplest primitive (3 sub-components, uses only `useControllableState`). Building it first validates the compound component pattern before tackling Dialog and Tabs.

- [ ] **Step 1: Write failing tests**

`src/collapsible/collapsible.spec.tsx`:
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Collapsible } from './collapsible';

describe('Collapsible', () => {
  it('renders closed by default', () => {
    render(
      <Collapsible.Root>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Content>Content</Collapsible.Content>
      </Collapsible.Root>,
    );
    expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders open with defaultOpen', () => {
    render(
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Content>Content</Collapsible.Content>
      </Collapsible.Root>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('toggles on trigger click', async () => {
    render(
      <Collapsible.Root>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Content>Content</Collapsible.Content>
      </Collapsible.Root>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Content')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('fires onOpenChange', async () => {
    const onOpenChange = vi.fn();
    render(
      <Collapsible.Root onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Content>Content</Collapsible.Content>
      </Collapsible.Root>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('sets data-state on all sub-components', () => {
    const { container } = render(
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Content>Content</Collapsible.Content>
      </Collapsible.Root>,
    );
    expect(container.firstElementChild).toHaveAttribute('data-state', 'open');
    expect(screen.getByRole('button')).toHaveAttribute('data-state', 'open');
    expect(screen.getByRole('region')).toHaveAttribute('data-state', 'open');
  });

  it('disabled prevents toggle', async () => {
    render(
      <Collapsible.Root disabled>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Content>Content</Collapsible.Content>
      </Collapsible.Root>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('forceMount keeps content in DOM when closed', () => {
    render(
      <Collapsible.Root>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Content forceMount>Content</Collapsible.Content>
      </Collapsible.Root>,
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Content').parentElement).toHaveAttribute(
      'data-state',
      'closed',
    );
  });

  it('links trigger and content via aria-controls', () => {
    render(
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Content>Content</Collapsible.Content>
      </Collapsible.Root>,
    );
    const trigger = screen.getByRole('button');
    const content = screen.getByRole('region');
    expect(trigger.getAttribute('aria-controls')).toBe(content.id);
  });

  it('passes className and HTML attributes to Root', () => {
    const { container } = render(
      <Collapsible.Root className="my-class" data-custom="test">
        <Collapsible.Trigger>T</Collapsible.Trigger>
        <Collapsible.Content>C</Collapsible.Content>
      </Collapsible.Root>,
    );
    expect(container.firstElementChild).toHaveClass('my-class');
    expect(container.firstElementChild).toHaveAttribute('data-custom', 'test');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/react-headless && npx vitest run src/collapsible/collapsible.spec.tsx`
Expected: FAIL

- [ ] **Step 3: Implement Collapsible**

`src/collapsible/collapsible.tsx` — implement `Collapsible.Root`, `Collapsible.Trigger`, `Collapsible.Content` as a namespace object with context-based compound components. Use `useControllableState` for open state. Generate IDs with `useId()`. Set `data-state`, `aria-expanded`, `aria-controls`, `role="region"`, `aria-labelledby`. Support `asChild` via `Slot`. Support `forceMount` and `disabled`.

Reference the spec (lines 321-350) for the full behavior contract.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/react-headless && npx vitest run src/collapsible/collapsible.spec.tsx`
Expected: 9 tests PASS

- [ ] **Step 5: Export from index.ts**

Add to `src/index.ts`:
```typescript
export { Collapsible } from './collapsible/collapsible';
```

- [ ] **Step 6: Commit**

```bash
git add packages/react-headless/src/collapsible/ packages/react-headless/src/index.ts
git commit -m "feat(react-headless): add Collapsible compound component"
```

---

## Task 8: Dialog Primitive

**Files:**
- Create: `packages/react-headless/src/dialog/dialog.tsx`
- Create: `packages/react-headless/src/dialog/dialog.spec.tsx`
- Modify: `packages/react-headless/src/index.ts`

- [ ] **Step 1: Write failing tests**

`src/dialog/dialog.spec.tsx` — tests for all 8 sub-components:
- `Dialog.Root` manages open state (controlled + uncontrolled)
- `Dialog.Trigger` renders button with `aria-haspopup="dialog"`, `aria-expanded`, `data-state`
- `Dialog.Portal` renders content via Portal
- `Dialog.Overlay` renders div with `aria-hidden="true"`, click calls `onOpenChange(false)`
- `Dialog.Content` has `role="dialog"`, `aria-modal="true"`, `aria-labelledby`/`aria-describedby` (conditional), `data-state`, `forceMount`
- `Dialog.Title` auto-generates ID, linked to Content
- `Dialog.Description` auto-generates ID, linked to Content
- `Dialog.Close` calls `onOpenChange(false)`
- Escape fires `onEscapeKeyDown` then closes
- Overlay click fires `onPointerDownOutside`
- `onInteractOutside` fires on both Escape and overlay click
- `asChild` works on Trigger and Close
- Controlled mode (`open` prop) and uncontrolled mode (`defaultOpen` prop) both work
- Dev warning when Title is omitted (mock `console.warn`)
- Non-modal: no `aria-modal`, no focus trap call

Reference spec lines 224-273 for full behavior.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/react-headless && npx vitest run src/dialog/dialog.spec.tsx`
Expected: FAIL

- [ ] **Step 3: Implement Dialog**

`src/dialog/dialog.tsx` — implement all 8 sub-components. Use `useControllableState` for open, `useFocusTrap` for modal focus, `useScrollLock` for modal scroll, `Portal` for rendering, `Slot` for asChild. Use `useId()` for auto-IDs on Title and Description. Wire `aria-labelledby`/`aria-describedby` via context — only set when Title/Description are mounted.

Key implementation detail: Title and Description register their IDs with the dialog context on mount and deregister on unmount, so Content can conditionally set the ARIA attributes.

Reference spec lines 224-273 for the full behavior contract.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/react-headless && npx vitest run src/dialog/dialog.spec.tsx`
Expected: all PASS

- [ ] **Step 5: Export from index.ts**

Add to `src/index.ts`:
```typescript
export { Dialog } from './dialog/dialog';
```

- [ ] **Step 6: Commit**

```bash
git add packages/react-headless/src/dialog/ packages/react-headless/src/index.ts
git commit -m "feat(react-headless): add Dialog compound component with focus trap and scroll lock"
```

---

## Task 9: Tabs Primitive

**Files:**
- Create: `packages/react-headless/src/tabs/tabs.tsx`
- Create: `packages/react-headless/src/tabs/tabs.spec.tsx`
- Modify: `packages/react-headless/src/index.ts`

- [ ] **Step 1: Write failing tests**

`src/tabs/tabs.spec.tsx` — tests for all 4 sub-components:
- `Tabs.Root` manages active value (controlled + uncontrolled), passes `className` and HTML attrs through
- `Tabs.Root` with `asChild` renders as child element (e.g., `<nav>`)
- `Tabs.List` has `role="tablist"`, `aria-orientation`
- `Tabs.Trigger` has `role="tab"`, `aria-selected`, `aria-controls`, auto-generated ID
- `Tabs.Content` has `role="tabpanel"`, `aria-labelledby`, only renders for active value
- `Tabs.Content` with `forceMount` renders even when inactive
- Disabled trigger has `aria-disabled`
- `onValueChange` fires on trigger click
- `asChild` works on Trigger (render as `<a>`)
- Auto-generated IDs link Trigger↔Content

Reference spec lines 275-319 for full behavior. Keyboard arrow-key focus tests are deferred to e2e (real browser needed for focus verification). However, include a unit test for `activationMode: 'manual'`: clicking a trigger in manual mode should NOT change the active value — only Enter/Space should activate.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/react-headless && npx vitest run src/tabs/tabs.spec.tsx`
Expected: FAIL

- [ ] **Step 3: Implement Tabs**

`src/tabs/tabs.tsx` — implement Root, List, Trigger, Content. Use `useControllableState` for active value, `useRovingFocus` inside List for keyboard nav. Auto-generate IDs with `useId()`. Wire `aria-controls`/`aria-labelledby` via context. Support `activationMode` (automatic/manual). Support `asChild` via Slot on Root, Trigger, and Content. Set `orientation` on context so useRovingFocus uses the right arrow keys.

Internal design: Root provides context with `{ value, onValueChange, orientation, activationMode, registerTrigger, registerContent }`. Triggers register on mount to get their index for roving focus. Content checks context value to decide whether to render.

Reference spec lines 275-319 for the full behavior contract.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/react-headless && npx vitest run src/tabs/tabs.spec.tsx`
Expected: all PASS

- [ ] **Step 5: Export from index.ts**

Add to `src/index.ts`:
```typescript
export { Tabs } from './tabs/tabs';
```

- [ ] **Step 6: Commit**

```bash
git add packages/react-headless/src/tabs/ packages/react-headless/src/index.ts
git commit -m "feat(react-headless): add Tabs compound component with roving focus"
```

---

## Task 10: Accordion Primitive

**Files:**
- Create: `packages/react-headless/src/accordion/accordion.tsx`
- Create: `packages/react-headless/src/accordion/accordion.spec.tsx`
- Modify: `packages/react-headless/src/index.ts`

- [ ] **Step 1: Write failing tests**

`src/accordion/accordion.spec.tsx` — tests for all 5 sub-components:
- Single mode: opening item B closes item A
- Single mode non-collapsible: clicking open item does nothing
- Single mode collapsible: clicking open item closes it
- Multiple mode: independent open/close
- `onValueChange` fires with correct value type (string for single, string[] for multiple)
- `Accordion.Header` renders `<h3>`, supports `asChild`
- `Accordion.Trigger` has `aria-expanded`, `aria-controls`, `aria-disabled`
- `Accordion.Content` has `role="region"`, `aria-labelledby`
- `data-state` and `data-disabled` on all sub-components
- Disabled item cannot toggle
- `forceMount` keeps Content in DOM
- Controlled mode works

Reference spec lines 352-406 for full behavior.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/react-headless && npx vitest run src/accordion/accordion.spec.tsx`
Expected: FAIL

- [ ] **Step 3: Implement Accordion**

`src/accordion/accordion.tsx` — implement Root, Item, Header, Trigger, Content. Root manages open items using `useControllableState` (string for single, string[] for multiple). Use `useRovingFocus` with vertical orientation for keyboard nav between triggers across items.

If the file grows large, consider splitting into `accordion-root.tsx` (Root + context) and `accordion-item.tsx` (Item + Header + Trigger + Content).

Reference spec lines 352-406 for the full behavior contract.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/react-headless && npx vitest run src/accordion/accordion.spec.tsx`
Expected: all PASS

- [ ] **Step 5: Export from index.ts**

Add to `src/index.ts`:
```typescript
export { Accordion } from './accordion/accordion';
```

- [ ] **Step 6: Run all unit tests**

Run: `cd packages/react-headless && npx vitest run`
Expected: all tests PASS across all files

- [ ] **Step 7: Commit**

```bash
git add packages/react-headless/src/accordion/ packages/react-headless/src/index.ts
git commit -m "feat(react-headless): add Accordion compound component with single/multiple modes"
```

---

## Task 11: Playwright E2E Setup + Dialog E2E

**Files:**
- Create: `packages/react-headless/playwright.config.ts`
- Create: `packages/react-headless/e2e/fixtures/index.html`
- Create: `packages/react-headless/e2e/fixtures/main.tsx`
- Create: `packages/react-headless/e2e/fixtures/test-app.tsx`
- Create: `packages/react-headless/e2e/dialog.spec.ts`

- [ ] **Step 1: Create Playwright config**

`playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env['CI'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command: 'npx vite --config e2e/fixtures/vite.config.ts --port 5199',
    url: 'http://localhost:5199',
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Create e2e test app fixtures**

`e2e/fixtures/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Headless E2E</title></head>
<body style="height: 200vh;">
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

`e2e/fixtures/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: __dirname,
});
```

`e2e/fixtures/main.tsx`:
```typescript
import { createRoot } from 'react-dom/client';
import { TestApp } from './test-app';

createRoot(document.getElementById('root')!).render(<TestApp />);
```

`e2e/fixtures/test-app.tsx` — a minimal React app with routes/sections for each primitive scenario. Renders Dialog, Tabs, Collapsible, and Accordion test fixtures that the Playwright specs interact with. Each scenario is toggled via URL hash (e.g., `#dialog-basic`, `#dialog-nested`, `#tabs-auto`, `#tabs-manual`).

Include scenarios for: basic dialog, nested dialog, dialog with forceMount, tabs automatic, tabs manual, tabs disabled, collapsible basic, collapsible disabled, collapsible forceMount, accordion single, accordion multiple, accordion disabled.

- [ ] **Step 3: Install Playwright browsers**

Run: `cd packages/react-headless && npx playwright install chromium firefox`
Expected: Browsers downloaded

- [ ] **Step 4: Write Dialog e2e tests**

`e2e/dialog.spec.ts` — reference spec lines 446-457:
- Focus moves into Content on open (test with `page.keyboard.press('Tab')`)
- Tab cycles within Content (does not escape)
- Shift+Tab wraps from first to last focusable
- Escape closes dialog
- Click outside overlay closes dialog
- Focus returns to Trigger after close
- Body scroll locked while open (check `document.body.style.overflow` via `page.evaluate`)
- Nested dialog: inner traps focus, closing inner returns focus to outer
- `aria-labelledby` matches Dialog.Title's ID
- `forceMount`: Content remains in DOM with `data-state="closed"`

- [ ] **Step 5: Run Dialog e2e tests**

Run: `cd packages/react-headless && npx playwright test e2e/dialog.spec.ts`
Expected: all PASS on both Chromium and Firefox

- [ ] **Step 6: Commit**

```bash
git add packages/react-headless/playwright.config.ts packages/react-headless/e2e/
git commit -m "test(react-headless): add Playwright e2e setup and Dialog cross-browser tests"
```

---

## Task 12: Tabs, Collapsible, and Accordion E2E

**Files:**
- Create: `packages/react-headless/e2e/tabs.spec.ts`
- Create: `packages/react-headless/e2e/collapsible.spec.ts`
- Create: `packages/react-headless/e2e/accordion.spec.ts`

- [ ] **Step 1: Write Tabs e2e tests**

`e2e/tabs.spec.ts` — reference spec lines 459-466:
- Arrow keys move focus between triggers
- Home/End jump to first/last
- Automatic mode: arrow activates tab, correct panel displays
- Manual mode: arrow moves focus only, Enter activates
- Disabled trigger skipped during navigation
- Tab key exits tablist (focus not trapped)
- `aria-selected` state correct across browsers

- [ ] **Step 2: Write Collapsible e2e tests**

`e2e/collapsible.spec.ts` — reference spec lines 468-473:
- Click trigger toggles content visibility
- `data-state` attribute updates on open/close
- Keyboard: Enter/Space on trigger toggles
- Disabled collapsible does not toggle
- `forceMount`: content stays in DOM, `data-state` changes

- [ ] **Step 3: Write Accordion e2e tests**

`e2e/accordion.spec.ts` — reference spec lines 475-483:
- Single mode: opening B closes A
- Multiple mode: A and B both open
- Collapsible single: clicking open item closes it
- Non-collapsible single: clicking open item does nothing
- Arrow key navigation between triggers (vertical)
- Home/End jump to first/last trigger
- Disabled items skipped
- `data-disabled` present on disabled items

- [ ] **Step 4: Run all e2e tests**

Run: `cd packages/react-headless && npx playwright test`
Expected: all PASS on both Chromium and Firefox

- [ ] **Step 5: Commit**

```bash
git add packages/react-headless/e2e/
git commit -m "test(react-headless): add Tabs, Collapsible, and Accordion cross-browser e2e tests"
```

---

## Task 13: react-ui Migration — DialogPanel

**Files:**
- Modify: `packages/react-ui/package.json` — add `@aspect/react-headless` dependency
- Modify: `packages/react-ui/src/dialog-panel.tsx`
- Modify: `packages/react-ui/src/dialog-panel.spec.tsx`

- [ ] **Step 1: Add react-headless dependency to react-ui**

In `packages/react-ui/package.json`, add to `dependencies`:
```json
"@aspect/react-headless": "*"
```

Run: `cd packages/react-ui && npm install`

- [ ] **Step 2: Rewrite DialogPanel to use headless Dialog**

Replace `packages/react-ui/src/dialog-panel.tsx` with the migration code from the spec (lines 491-507). Keep the same `DialogPanelProps` interface.

- [ ] **Step 3: Update DialogPanel tests**

Update `packages/react-ui/src/dialog-panel.spec.tsx`:
- Keep existing tests (title/body/footer rendering, variant, onClose on backdrop click, onClose on Escape)
- Add test: `role="dialog"` and `aria-modal="true"` are present (now provided by headless Dialog)
- Add test: `aria-labelledby` links to title element

- [ ] **Step 4: Run react-ui tests**

Run: `cd packages/react-ui && npx vitest run`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/react-ui/package.json packages/react-ui/src/dialog-panel.tsx packages/react-ui/src/dialog-panel.spec.tsx
git commit -m "refactor(react-ui): migrate DialogPanel to @aspect/react-headless Dialog"
```

---

## Task 14: react-ui Migration — TabNav/TabLink

**Files:**
- Modify: `packages/react-ui/src/tab-nav.tsx`
- Modify: `packages/react-ui/src/tab-nav.spec.tsx`
- Modify: `packages/react-ui/src/index.ts`

- [ ] **Step 1: Rewrite TabNav and TabLink**

Replace `packages/react-ui/src/tab-nav.tsx` with the migration code from the spec (lines 514-533). Update `TabNavProps` to include `value`, `onValueChange`, `children`. Update `TabLinkProps` to include `value`, `href`, remove `active`.

- [ ] **Step 2: Update index.ts type exports**

Update `packages/react-ui/src/index.ts` if TabLinkProps type signature changed.

- [ ] **Step 3: Update TabNav/TabLink tests**

Replace `packages/react-ui/src/tab-nav.spec.tsx`:
- Test that TabNav renders `<nav>` element (preserved via `asChild`)
- Test that TabList has `role="tablist"`
- Test that TabLink renders with `role="tab"` and `aria-selected`
- Test that active tab has `aria-selected="true"`

- [ ] **Step 4: Run react-ui tests**

Run: `cd packages/react-ui && npx vitest run`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/react-ui/src/tab-nav.tsx packages/react-ui/src/tab-nav.spec.tsx packages/react-ui/src/index.ts
git commit -m "refactor(react-ui): migrate TabNav/TabLink to @aspect/react-headless Tabs"
```

---

## Task 15: react-ui Migration — CollapsiblePanel

**Files:**
- Modify: `packages/react-ui/src/collapsible-panel.tsx`
- Modify: `packages/react-ui/src/collapsible-panel.spec.tsx`
- Modify: `packages/react-ui/src/index.ts`

- [ ] **Step 1: Rewrite CollapsiblePanel**

Replace `packages/react-ui/src/collapsible-panel.tsx` with the migration code from the spec (lines 548-573). Update `CollapsiblePanelProps` to add `defaultOpen`, `onOpenChange`, `disabled`.

- [ ] **Step 2: Update index.ts type exports**

Update `packages/react-ui/src/index.ts` if CollapsiblePanelProps signature changed.

- [ ] **Step 3: Update CollapsiblePanel tests**

Replace `packages/react-ui/src/collapsible-panel.spec.tsx`:
- Test renders closed by default (button has `aria-expanded="false"`)
- Test renders open with `defaultOpen`
- Test variant and size applied via `data-*` on Root div
- Test toggle via click
- Test `onOpenChange` fires
- Test disabled prevents toggle

- [ ] **Step 4: Run all react-ui tests**

Run: `cd packages/react-ui && npx vitest run`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/react-ui/src/collapsible-panel.tsx packages/react-ui/src/collapsible-panel.spec.tsx packages/react-ui/src/index.ts
git commit -m "refactor(react-ui): migrate CollapsiblePanel to @aspect/react-headless Collapsible"
```

---

## Task 16: Design-System CSS Updates

**Files:**
- Modify: `packages/design-system/components-tabs.css`
- Modify: `packages/design-system/components-panels.css`

- [ ] **Step 1: Add aria-selected rule to tabs CSS**

In `packages/design-system/components-tabs.css`, add after the `.tab-active` rule:

```css
.tab-link[aria-selected="true"] {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);

  [data-effects="glow-glass"] & {
    text-shadow: 0 0 12px var(--glow-color);
  }
}
```

- [ ] **Step 2: Update collapsible panel CSS**

In `packages/design-system/components-panels.css`:
1. Replace `[open] > .collapsible-panel-trigger > &` with `[data-state="open"] > .collapsible-panel-trigger > &`
2. Remove the `&::-webkit-details-marker` and `&::marker` rules from `.collapsible-panel-trigger`

- [ ] **Step 3: Commit**

```bash
git add packages/design-system/components-tabs.css packages/design-system/components-panels.css
git commit -m "fix(design-system): update CSS selectors for headless component migration"
```

---

## Task 17: Admin Layout Consumer Migration

**Files:**
- Modify: `apps/main/react-frontend/src/features/admin/admin-layout.tsx`

- [ ] **Step 1: Update admin-layout to use TabLink**

Replace `NavLink` with `TabLink` from `@aspect/react-ui`. Derive `value` from the current path. Use `onValueChange` to navigate via React Router's `navigate()`. Do NOT include `href` on `TabLink` — navigation is handled by `onValueChange`, and an `href` on an `<a>` would cause a full page reload in an SPA. Alternatively, if `href` is used for progressive enhancement, the Tabs.Trigger implementation must call `event.preventDefault()` on click before firing `onValueChange`.

```tsx
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PageLayout, PageHeader, TabNav, TabLink } from '@aspect/react-ui';

export default function AdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeTab = pathname.startsWith('/admin/users') ? 'users' : 'permissions';

  return (
    <PageLayout
      header={
        <PageHeader title="Administration" subtitle="Manage users and permissions" />
      }
    >
      <TabNav value={activeTab} onValueChange={(v) => void navigate(`/admin/${v}`)}>
        <TabLink value="permissions">Permissions</TabLink>
        <TabLink value="users">Users</TabLink>
      </TabNav>
      <div className="p-lg">
        <Outlet />
      </div>
    </PageLayout>
  );
}
```

- [ ] **Step 2: Run react-frontend tests**

Run: `cd apps/main/react-frontend && npx vitest run`
Expected: PASS (or no breakage)

- [ ] **Step 3: Commit**

```bash
git add apps/main/react-frontend/src/features/admin/admin-layout.tsx
git commit -m "refactor(admin): migrate TabNav consumer to headless-backed TabLink"
```

---

## Task 18: Final Verification

- [ ] **Step 1: Run all react-headless unit tests**

Run: `cd packages/react-headless && npx vitest run`
Expected: all PASS

- [ ] **Step 2: Run all react-headless e2e tests**

Run: `cd packages/react-headless && npx playwright test`
Expected: all PASS on Chromium and Firefox

- [ ] **Step 3: Run all react-ui tests**

Run: `cd packages/react-ui && npx vitest run`
Expected: all PASS

- [ ] **Step 4: Run react-frontend tests**

Run: `cd apps/main/react-frontend && npx vitest run`
Expected: all PASS

- [ ] **Step 5: Build all packages**

Run: `cd packages/react-headless && npm run build && cd ../react-ui && npm run build`
Expected: both build without errors

- [ ] **Step 6: Final commit (if any remaining changes)**

```bash
git status
# If clean, no commit needed
```
