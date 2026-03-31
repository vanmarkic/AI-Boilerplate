# React Storybook for `packages/react-ui/`

**Date:** 2026-03-31
**Status:** Draft

## Goal

Add Storybook 9 with Vite builder to `packages/react-ui/`, providing a visual dev/testing environment for all 13 existing React components. Includes a theme switcher toolbar matching the Angular Storybook's 6 themes + glow-glass effects toggle.

## Scope

- Storybook configuration (fresh install, no migration)
- CSF3 stories for all 13 components
- Theme + effects toolbar
- No addons beyond SB9 built-in essentials
- No new components

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `storybook` | ^9 | Core (includes essentials: controls, actions, viewport) |
| `@storybook/react-vite` | ^9 | React + Vite framework integration |

## Configuration

### `.storybook/main.ts`

```typescript
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.tsx"],
};

export default config;
```

### `.storybook/preview.ts`

```typescript
import type { Preview } from "@storybook/react-vite";
import "@aspect/design-system";

const preview: Preview = {
  initialGlobals: {
    theme: "",
    effects: "glow-glass",
  },
  globalTypes: {
    theme: {
      description: "Design system theme",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: [
          { value: "", title: "Naval Group Corporate" },
          { value: "steel-blue", title: "Steel Blue" },
          { value: "ocean", title: "Ocean" },
          { value: "tfc-hoi", title: "HOI4" },
          { value: "tfc-cyber", title: "Cyber" },
          { value: "tfc-health", title: "Health" },
          { value: "tfc-military", title: "Military" },
        ],
        dynamicTitle: true,
      },
    },
    effects: {
      description: "Visual effects",
      toolbar: {
        title: "Effects",
        icon: "star",
        items: [
          { value: "glow-glass", title: "Glow & Glass" },
          { value: "", title: "None" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || "";
      const effects = context.globals.effects || "";
      document.documentElement.setAttribute("data-theme", theme);
      document.documentElement.setAttribute("data-effects", effects);
      return Story();
    },
  ],
};

export default preview;
```

## Stories

All stories use CSF3 format. Each file is colocated with its component source.

### File inventory

| File | Category | Variants |
|------|----------|----------|
| `src/button/button.stories.tsx` | Components | Default, Destructive, Outline, Ghost, Small, Large |
| `src/badge/badge.stories.tsx` | Components | Default, Secondary, Destructive, Outline |
| `src/input/input.stories.tsx` | Components | Default, WithPlaceholder, Disabled |
| `src/form-error/form-error.stories.tsx` | Components | Default, LongMessage |
| `src/data-table/data-table.stories.tsx` | Components | Default, WithSorting, Empty |
| `src/dialog-panel/dialog-panel.stories.tsx` | Components | Default, Open |
| `src/collapsible-panel/collapsible-panel.stories.tsx` | Components | Collapsed, Expanded |
| `src/histogram-timeline/histogram-timeline.stories.tsx` | Components | Default, MultiBar |
| `src/tab-nav/tab-nav.stories.tsx` | Components | Default, MultipleTabs |
| `src/stack/stack.stories.tsx` | Layout | Horizontal, Vertical, WithGap |
| `src/grid/grid.stories.tsx` | Layout | Basic, WithSpans |
| `src/page-layout/page-layout.stories.tsx` | Layout | WithHeaderAndFooter |
| `src/page-header/page-header.stories.tsx` | Layout | TitleOnly, WithActions |

### Story structure (example)

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: "Click me" },
};

export const Destructive: Story = {
  args: { children: "Delete", variant: "destructive" },
};
```

## Package changes

### `packages/react-ui/package.json`

New devDependencies:
```json
{
  "storybook": "^9",
  "@storybook/react-vite": "^9"
}
```

New scripts:
```json
{
  "storybook": "storybook dev -p 6007",
  "build-storybook": "storybook build"
}
```

Port 6007 avoids conflict with the Angular Storybook on 6006.

### Root `Makefile`

New target:
```makefile
storybook-react: ## Start React Storybook dev server
	yarn workspace @aspect/react-ui run storybook
```

## File structure

```
packages/react-ui/
├── .storybook/
│   ├── main.ts
│   └── preview.ts
└── src/
    ├── button/
    │   ├── button.tsx
    │   ├── button.spec.tsx
    │   └── button.stories.tsx      ← new
    ├── badge/
    │   ├── badge.tsx
    │   ├── badge.spec.tsx
    │   └── badge.stories.tsx       ← new
    ├── input/
    │   └── input.stories.tsx       ← new
    ├── form-error/
    │   └── form-error.stories.tsx  ← new
    ├── data-table/
    │   └── data-table.stories.tsx  ← new
    ├── dialog-panel/
    │   └── dialog-panel.stories.tsx ← new
    ├── collapsible-panel/
    │   └── collapsible-panel.stories.tsx ← new
    ├── histogram-timeline/
    │   └── histogram-timeline.stories.tsx ← new
    ├── tab-nav/
    │   └── tab-nav.stories.tsx     ← new
    ├── stack/
    │   └── stack.stories.tsx       ← new
    ├── grid/
    │   └── grid.stories.tsx        ← new
    ├── page-layout/
    │   └── page-layout.stories.tsx ← new
    └── page-header/
        └── page-header.stories.tsx ← new
```

## Out of scope

- No `addon-a11y` or `addon-docs` (per user decision)
- No new components (component parity with Angular is a separate effort)
- No CI integration for Storybook build (can be added later)
- No visual regression testing
