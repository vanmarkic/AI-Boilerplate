# React Storybook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Storybook 9 with Vite builder and CSF3 stories for all 13 react-ui component files (14 exports).

**Architecture:** Fresh Storybook 9 install in `packages/react-ui/` using `@storybook/react-vite`. A `.storybook/` directory holds `main.ts` and `preview.tsx`. Story files are colocated flat alongside component source files. A theme/effects toolbar decorator mirrors the Angular Storybook's setup.

**Tech Stack:** `storybook@^9`, `@storybook/react-vite@^9`, Vite, React 19, CSF3

**Spec:** `docs/superpowers/specs/2026-03-31-react-storybook-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/react-ui/.storybook/main.ts` | SB9 framework config |
| Create | `packages/react-ui/.storybook/preview.tsx` | Theme/effects toolbar + design-system CSS import |
| Create | `packages/react-ui/src/button.stories.tsx` | Button stories |
| Create | `packages/react-ui/src/badge.stories.tsx` | Badge stories |
| Create | `packages/react-ui/src/input.stories.tsx` | Input stories |
| Create | `packages/react-ui/src/form-error.stories.tsx` | FormError stories |
| Create | `packages/react-ui/src/data-table.stories.tsx` | DataTable stories |
| Create | `packages/react-ui/src/dialog-panel.stories.tsx` | DialogPanel stories |
| Create | `packages/react-ui/src/collapsible-panel.stories.tsx` | CollapsiblePanel stories |
| Create | `packages/react-ui/src/histogram-timeline.stories.tsx` | HistogramTimeline stories |
| Create | `packages/react-ui/src/tab-nav.stories.tsx` | TabNav + TabLink stories |
| Create | `packages/react-ui/src/stack.stories.tsx` | Stack stories |
| Create | `packages/react-ui/src/grid.stories.tsx` | Grid + Cell stories |
| Create | `packages/react-ui/src/page-layout.stories.tsx` | PageLayout stories |
| Create | `packages/react-ui/src/page-header.stories.tsx` | PageHeader stories |
| Modify | `packages/react-ui/package.json` | Add devDeps + scripts |
| Modify | `Makefile` | Add `storybook-react` target + `.PHONY` |

---

## Task 1: Install dependencies and add scripts

**Files:**
- Modify: `packages/react-ui/package.json`

- [ ] **Step 1: Install Storybook packages**

```bash
cd /home/dma/Projects/cyberchallenge/AI-Boilerplate
yarn workspace @aspect/react-ui add -D storybook @storybook/react-vite
```

- [ ] **Step 2: Add scripts to package.json**

Add to the `"scripts"` object in `packages/react-ui/package.json`:

```json
"storybook": "storybook dev -p 6007",
"build-storybook": "storybook build"
```

- [ ] **Step 3: Commit**

```bash
git add packages/react-ui/package.json yarn.lock
git commit -m "chore(react-ui): add storybook 9 dev dependencies"
```

---

## Task 2: Create Storybook configuration

**Files:**
- Create: `packages/react-ui/.storybook/main.ts`
- Create: `packages/react-ui/.storybook/preview.tsx`

- [ ] **Step 1: Create main.ts**

```typescript
// packages/react-ui/.storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.tsx"],
};

export default config;
```

- [ ] **Step 2: Create preview.tsx**

```tsx
// packages/react-ui/.storybook/preview.tsx
import type { Preview } from "storybook";
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
      return <Story />;
    },
  ],
};

export default preview;
```

- [ ] **Step 3: Verify Storybook builds**

```bash
cd /home/dma/Projects/cyberchallenge/AI-Boilerplate
yarn workspace @aspect/react-ui run build-storybook
```

Expected: Clean build with no errors (no stories yet, but config is valid). Delete `packages/react-ui/storybook-static/` after verifying.

- [ ] **Step 4: Commit**

```bash
git add packages/react-ui/.storybook/
git commit -m "feat(react-ui): add storybook 9 configuration with theme switcher"
```

---

## Task 3: Button stories

**Files:**
- Create: `packages/react-ui/src/button.stories.tsx`

- [ ] **Step 1: Write stories**

```tsx
// packages/react-ui/src/button.stories.tsx
import type { Meta, StoryObj } from "storybook";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "ghost"],
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: "Button" },
};

export const Destructive: Story = {
  args: { children: "Delete", variant: "destructive" },
};

export const Outline: Story = {
  args: { children: "Cancel", variant: "outline" },
};

export const Ghost: Story = {
  args: { children: "More", variant: "ghost" },
};

export const Small: Story = {
  args: { children: "Small", size: "sm" },
};

export const Large: Story = {
  args: { children: "Large", size: "lg" },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-ui/src/button.stories.tsx
git commit -m "feat(react-ui): add button storybook stories"
```

---

## Task 4: Badge stories

**Files:**
- Create: `packages/react-ui/src/badge.stories.tsx`

- [ ] **Step 1: Write stories**

```tsx
// packages/react-ui/src/badge.stories.tsx
import type { Meta, StoryObj } from "storybook";
import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { children: "Badge" },
};

export const Secondary: Story = {
  args: { children: "Secondary", variant: "secondary" },
};

export const Destructive: Story = {
  args: { children: "Error", variant: "destructive" },
};

export const Outline: Story = {
  args: { children: "Outline", variant: "outline" },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-ui/src/badge.stories.tsx
git commit -m "feat(react-ui): add badge storybook stories"
```

---

## Task 5: Input stories

**Files:**
- Create: `packages/react-ui/src/input.stories.tsx`

- [ ] **Step 1: Write stories**

```tsx
// packages/react-ui/src/input.stories.tsx
import type { Meta, StoryObj } from "storybook";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "Components/Input",
  component: Input,
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { label: "Email" },
};

export const WithPlaceholder: Story = {
  args: { label: "Name", placeholder: "Enter your name" },
};

export const Disabled: Story = {
  args: { label: "Locked", value: "Read only", disabled: true },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-ui/src/input.stories.tsx
git commit -m "feat(react-ui): add input storybook stories"
```

---

## Task 6: FormError stories

**Files:**
- Create: `packages/react-ui/src/form-error.stories.tsx`

- [ ] **Step 1: Write stories**

```tsx
// packages/react-ui/src/form-error.stories.tsx
import type { Meta, StoryObj } from "storybook";
import { FormError } from "./form-error";

const meta: Meta<typeof FormError> = {
  title: "Components/FormError",
  component: FormError,
};

export default meta;
type Story = StoryObj<typeof FormError>;

export const Required: Story = {
  args: { errors: { required: true }, touched: true },
};

export const Email: Story = {
  args: { errors: { email: true }, touched: true },
};

export const MultipleErrors: Story = {
  args: {
    errors: { required: true, minlength: { requiredLength: 3 } },
    touched: true,
  },
};

export const Untouched: Story = {
  args: { errors: { required: true }, touched: false },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-ui/src/form-error.stories.tsx
git commit -m "feat(react-ui): add form-error storybook stories"
```

---

## Task 7: DataTable stories

**Files:**
- Create: `packages/react-ui/src/data-table.stories.tsx`

- [ ] **Step 1: Write stories**

```tsx
// packages/react-ui/src/data-table.stories.tsx
import type { Meta, StoryObj } from "storybook";
import { DataTable } from "./data-table";
import type { DataTableColumn } from "./data-table";

interface Ship {
  name: string;
  class: string;
  displacement: number;
}

const sampleData: Ship[] = [
  { name: "Charles de Gaulle", class: "Aircraft Carrier", displacement: 42000 },
  { name: "Suffren", class: "Submarine", displacement: 5300 },
  { name: "Alsace", class: "Frigate", displacement: 4600 },
  { name: "Forbin", class: "Destroyer", displacement: 7050 },
  { name: "Mistral", class: "Amphibious", displacement: 21300 },
];

const columns: DataTableColumn<Ship>[] = [
  { accessor: "name", header: "Name", sortable: true },
  { accessor: "class", header: "Class", sortable: true },
  {
    accessor: "displacement",
    header: "Displacement (t)",
    sortable: true,
    cell: (row) => row.displacement.toLocaleString(),
  },
];

const meta: Meta<typeof DataTable<Ship>> = {
  title: "Components/DataTable",
  component: DataTable,
};

export default meta;
type Story = StoryObj<typeof DataTable<Ship>>;

export const Default: Story = {
  args: { data: sampleData, columns },
};

export const WithSorting: Story = {
  args: { data: sampleData, columns },
};

export const WithClickableRows: Story = {
  args: { data: sampleData, columns, clickableRows: true },
};

export const Empty: Story = {
  args: { data: [], columns },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-ui/src/data-table.stories.tsx
git commit -m "feat(react-ui): add data-table storybook stories"
```

---

## Task 8: DialogPanel stories

**Files:**
- Create: `packages/react-ui/src/dialog-panel.stories.tsx`

- [ ] **Step 1: Write stories**

```tsx
// packages/react-ui/src/dialog-panel.stories.tsx
import type { Meta, StoryObj } from "storybook";
import { DialogPanel } from "./dialog-panel";
import { Button } from "./button";

const meta: Meta<typeof DialogPanel> = {
  title: "Components/DialogPanel",
  component: DialogPanel,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof DialogPanel>;

export const Default: Story = {
  args: {
    title: "Confirm action",
    children: "Are you sure you want to proceed?",
    footer: <Button>Confirm</Button>,
  },
};

export const Destructive: Story = {
  args: {
    variant: "destructive",
    title: "Delete item",
    children: "This action cannot be undone.",
    footer: <Button variant="destructive">Delete</Button>,
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-ui/src/dialog-panel.stories.tsx
git commit -m "feat(react-ui): add dialog-panel storybook stories"
```

---

## Task 9: CollapsiblePanel stories

**Files:**
- Create: `packages/react-ui/src/collapsible-panel.stories.tsx`

- [ ] **Step 1: Write stories**

```tsx
// packages/react-ui/src/collapsible-panel.stories.tsx
import type { Meta, StoryObj } from "storybook";
import { CollapsiblePanel } from "./collapsible-panel";

const meta: Meta<typeof CollapsiblePanel> = {
  title: "Components/CollapsiblePanel",
  component: CollapsiblePanel,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "ghost", "outline"],
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof CollapsiblePanel>;

export const Collapsed: Story = {
  args: {
    header: "Section title",
    children: "Panel content goes here.",
  },
};

export const Expanded: Story = {
  args: {
    open: true,
    header: "Section title",
    children: "Panel content goes here.",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    open: true,
    header: "Ghost variant",
    children: "Content with ghost styling.",
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-ui/src/collapsible-panel.stories.tsx
git commit -m "feat(react-ui): add collapsible-panel storybook stories"
```

---

## Task 10: HistogramTimeline stories

**Files:**
- Create: `packages/react-ui/src/histogram-timeline.stories.tsx`

- [ ] **Step 1: Write stories**

```tsx
// packages/react-ui/src/histogram-timeline.stories.tsx
import type { Meta, StoryObj } from "storybook";
import { HistogramTimeline } from "./histogram-timeline";
import type { HistogramBar, HistogramLabel } from "./histogram-timeline";

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function generateBars(count: number, seed = 42): HistogramBar[] {
  const rand = seededRandom(seed);
  return Array.from({ length: count }, () => ({ value: Math.floor(rand() * 100) }));
}

function generateLabels(count: number, step: number): HistogramLabel[] {
  return Array.from({ length: Math.ceil(count / step) }, (_, i) => ({
    index: i * step,
    text: `T${i * step}`,
  }));
}

const meta: Meta<typeof HistogramTimeline> = {
  title: "Components/HistogramTimeline",
  component: HistogramTimeline,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "success", "destructive", "muted"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof HistogramTimeline>;

const bars24 = generateBars(24);
const labels24 = generateLabels(24, 6);

export const Default: Story = {
  args: {
    bars: bars24,
    labels: labels24,
    ariaLabel: "24-hour activity histogram",
  },
};

export const Success: Story = {
  args: {
    bars: bars24,
    labels: labels24,
    ariaLabel: "Success histogram",
    variant: "success",
  },
};

export const Dense: Story = {
  args: {
    bars: generateBars(720, 99),
    labels: generateLabels(720, 120),
    ariaLabel: "Dense 720-bar histogram",
    variant: "muted",
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-ui/src/histogram-timeline.stories.tsx
git commit -m "feat(react-ui): add histogram-timeline storybook stories"
```

---

## Task 11: TabNav stories

**Files:**
- Create: `packages/react-ui/src/tab-nav.stories.tsx`

- [ ] **Step 1: Write stories**

```tsx
// packages/react-ui/src/tab-nav.stories.tsx
import type { Meta, StoryObj } from "storybook";
import { TabNav, TabLink } from "./tab-nav";

const meta: Meta<typeof TabNav> = {
  title: "Components/TabNav",
  component: TabNav,
};

export default meta;
type Story = StoryObj<typeof TabNav>;

export const Default: Story = {
  render: () => (
    <TabNav>
      <TabLink href="#" active>Overview</TabLink>
      <TabLink href="#">Details</TabLink>
      <TabLink href="#">History</TabLink>
    </TabNav>
  ),
};

export const NoActiveTab: Story = {
  render: () => (
    <TabNav>
      <TabLink href="#">Tab A</TabLink>
      <TabLink href="#">Tab B</TabLink>
    </TabNav>
  ),
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-ui/src/tab-nav.stories.tsx
git commit -m "feat(react-ui): add tab-nav storybook stories"
```

---

## Task 12: Stack stories

**Files:**
- Create: `packages/react-ui/src/stack.stories.tsx`

- [ ] **Step 1: Write stories**

```tsx
// packages/react-ui/src/stack.stories.tsx
import type { Meta, StoryObj } from "storybook";
import { Stack } from "./stack";

const Box = ({ children }: { children: string }) => (
  <div style={{ padding: "var(--spacing-sm)", background: "var(--color-muted)", borderRadius: "var(--radius-sm)" }}>
    {children}
  </div>
);

const meta: Meta<typeof Stack> = {
  title: "Layout/Stack",
  component: Stack,
  argTypes: {
    direction: { control: "select", options: ["vertical", "horizontal"] },
    gap: { control: "select", options: ["none", "xs", "sm", "md", "lg", "xl", "2xl"] },
    align: { control: "select", options: ["start", "center", "end", "stretch"] },
    justify: { control: "select", options: ["start", "center", "end", "between"] },
  },
};

export default meta;
type Story = StoryObj<typeof Stack>;

export const Vertical: Story = {
  render: (args) => (
    <Stack {...args}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Stack>
  ),
  args: { direction: "vertical", gap: "md" },
};

export const Horizontal: Story = {
  render: (args) => (
    <Stack {...args}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Stack>
  ),
  args: { direction: "horizontal", gap: "md" },
};

export const SpaceBetween: Story = {
  render: (args) => (
    <Stack {...args}>
      <Box>Left</Box>
      <Box>Right</Box>
    </Stack>
  ),
  args: { direction: "horizontal", justify: "between" },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-ui/src/stack.stories.tsx
git commit -m "feat(react-ui): add stack storybook stories"
```

---

## Task 13: Grid + Cell stories

**Files:**
- Create: `packages/react-ui/src/grid.stories.tsx`

- [ ] **Step 1: Write stories**

```tsx
// packages/react-ui/src/grid.stories.tsx
import type { Meta, StoryObj } from "storybook";
import { Grid, Cell } from "./grid";

const Box = ({ children }: { children: string }) => (
  <div style={{ padding: "var(--spacing-sm)", background: "var(--color-muted)", borderRadius: "var(--radius-sm)" }}>
    {children}
  </div>
);

const meta: Meta<typeof Grid> = {
  title: "Layout/Grid",
  component: Grid,
  argTypes: {
    columns: { control: "number" },
    gap: { control: "select", options: ["none", "xs", "sm", "md", "lg", "xl", "2xl"] },
  },
};

export default meta;
type Story = StoryObj<typeof Grid>;

export const ThreeColumns: Story = {
  render: (args) => (
    <Grid {...args}>
      <Box>1</Box>
      <Box>2</Box>
      <Box>3</Box>
      <Box>4</Box>
      <Box>5</Box>
      <Box>6</Box>
    </Grid>
  ),
  args: { columns: 3, gap: "md" },
};

export const WithCellSpans: Story = {
  render: (args) => (
    <Grid {...args}>
      <Cell span="full"><Box>Full width</Box></Cell>
      <Cell span={2}><Box>Span 2</Box></Cell>
      <Cell><Box>Span 1</Box></Cell>
      <Cell start={2} span={2}><Box>Start at col 2, span 2</Box></Cell>
    </Grid>
  ),
  args: { columns: 3, gap: "md" },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-ui/src/grid.stories.tsx
git commit -m "feat(react-ui): add grid and cell storybook stories"
```

---

## Task 14: PageLayout stories

**Files:**
- Create: `packages/react-ui/src/page-layout.stories.tsx`

- [ ] **Step 1: Write stories**

```tsx
// packages/react-ui/src/page-layout.stories.tsx
import type { Meta, StoryObj } from "storybook";
import { PageLayout } from "./page-layout";

const meta: Meta<typeof PageLayout> = {
  title: "Layout/PageLayout",
  component: PageLayout,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof PageLayout>;

export const WithHeaderAndFooter: Story = {
  args: {
    header: <div style={{ padding: "var(--spacing-md)" }}>Header</div>,
    footer: <div style={{ padding: "var(--spacing-md)" }}>Footer</div>,
    children: <div style={{ padding: "var(--spacing-md)" }}>Main content area</div>,
  },
};

export const ContentOnly: Story = {
  args: {
    children: <div style={{ padding: "var(--spacing-md)" }}>No header or footer</div>,
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-ui/src/page-layout.stories.tsx
git commit -m "feat(react-ui): add page-layout storybook stories"
```

---

## Task 15: PageHeader stories

**Files:**
- Create: `packages/react-ui/src/page-header.stories.tsx`

- [ ] **Step 1: Write stories**

```tsx
// packages/react-ui/src/page-header.stories.tsx
import type { Meta, StoryObj } from "storybook";
import { PageHeader } from "./page-header";
import { Button } from "./button";

const meta: Meta<typeof PageHeader> = {
  title: "Layout/PageHeader",
  component: PageHeader,
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const TitleOnly: Story = {
  args: { title: "Dashboard" },
};

export const WithSubtitle: Story = {
  args: { title: "Fleet Overview", subtitle: "Real-time vessel tracking" },
};

export const WithActions: Story = {
  args: {
    title: "Fleet Overview",
    subtitle: "Real-time vessel tracking",
    actions: <Button>Export</Button>,
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-ui/src/page-header.stories.tsx
git commit -m "feat(react-ui): add page-header storybook stories"
```

---

## Task 16: Makefile target + smoke test

**Files:**
- Modify: `Makefile` (line 1 `.PHONY` + new target)

- [ ] **Step 1: Add storybook-react to .PHONY**

Append `storybook-react` to the `.PHONY` declaration on line 1 of the root `Makefile`.

- [ ] **Step 2: Add the target**

Add after the existing `storybook` target:

```makefile
storybook-react: ## Start React Storybook dev server
	yarn workspace @aspect/react-ui run storybook
```

- [ ] **Step 3: Run build-storybook to verify everything compiles**

```bash
cd /home/dma/Projects/cyberchallenge/AI-Boilerplate
yarn workspace @aspect/react-ui run build-storybook
```

Expected: Clean build with no errors. Output goes to `packages/react-ui/storybook-static/`.

- [ ] **Step 4: Add storybook-static to .gitignore if not already ignored**

Check if `storybook-static` is already in a `.gitignore`. If not, add it to `packages/react-ui/.gitignore`:

```
storybook-static/
```

- [ ] **Step 5: Commit**

```bash
git add Makefile packages/react-ui/.gitignore
git commit -m "chore: add storybook-react makefile target"
```

---

## Task 17: Final verification

- [ ] **Step 1: Run make validate**

```bash
cd /home/dma/Projects/cyberchallenge/AI-Boilerplate
make validate
```

Expected: All linters, architecture checks, and tests pass. Fix any issues before proceeding.

- [ ] **Step 2: Run build-storybook to verify all stories compile**

```bash
yarn workspace @aspect/react-ui run build-storybook
```

Expected: Clean build with no errors. All 13 story files compile.

- [ ] **Step 3: Start Storybook and visually verify**

```bash
make storybook-react
```

Expected: Storybook opens on `http://localhost:6007` with sidebar showing:
- Components/ (Button, Badge, Input, FormError, DataTable, DialogPanel, CollapsiblePanel, HistogramTimeline, TabNav)
- Layout/ (Stack, Grid, PageLayout, PageHeader)

Theme toolbar switches between Naval Group Corporate, Steel Blue, Ocean. Effects toolbar toggles glow-glass on/off.
