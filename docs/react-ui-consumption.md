# Consuming `@aspect/react-ui` from another GitLab project

This library is distributed as a tarball CI artifact — no npm registry required.

## Installation

### 1. Add the dependency

In your project's `package.json`:

```json
{
  "dependencies": {
    "@aspect/react-ui": "https://<GITLAB_HOST>/api/v4/projects/<PROJECT_ID>/jobs/artifacts/master/raw/aspect-react-ui-0.0.0.tgz?job=pack-react-ui"
  }
}
```

Replace `<GITLAB_HOST>` and `<PROJECT_ID>` with the actual values for the AI-Boilerplate project.

### 2. Configure authentication

In your project's `.npmrc`:

```ini
//your-gitlab.com/api/v4/:_authToken=${GITLAB_TOKEN}
```

- **Local dev:** set `GITLAB_TOKEN` to a personal access token with `read_api` scope.
- **CI:** use `${CI_JOB_TOKEN}` which is injected automatically in GitLab CI.

### 3. Install

```bash
npm install
```

## Peer dependencies

The consuming project must provide these:

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

Optional (only if you use map components):

```json
{
  "dependencies": {
    "maplibre-gl": "^5.0.0",
    "pmtiles": "^4.0.0"
  }
}
```

## Usage

### Components

```tsx
import { Button, Input, DataTable, Card } from "@aspect/react-ui";
```

### Design system CSS

The full design system (tokens, reset, utilities, components) is bundled in the tarball.

```css
/* Import everything */
@import "@aspect/react-ui/design-system.css";
```

Or import individual layers for finer control:

```css
@import "@aspect/react-ui/design-system/tokens.css";
@import "@aspect/react-ui/design-system/reset.css";
@import "@aspect/react-ui/design-system/utilities.css";
@import "@aspect/react-ui/design-system/components.css";
```

### Available components

| Component | Import |
|---|---|
| `Button` | `{ Button, ButtonProps, ButtonVariant, ButtonSize }` |
| `Badge` | `{ Badge, BadgeProps, BadgeVariant }` |
| `Input` | `{ Input, InputProps }` |
| `FormError` | `{ FormError, FormErrorProps }` |
| `Card` | `{ Card, CardProps }` |
| `CardGroup` | `{ CardGroup, CardGroupProps, CardGroupMode }` |
| `DialogPanel` | `{ DialogPanel, DialogPanelProps }` |
| `CollapsiblePanel` | `{ CollapsiblePanel, CollapsiblePanelProps }` |
| `DrawerPanel` | `{ DrawerPanel, DrawerPanelProps, DrawerSide }` |
| `PageLayout` | `{ PageLayout, PageLayoutProps }` |
| `PageHeader` | `{ PageHeader, PageHeaderProps }` |
| `SidebarLayout` | `{ SidebarLayout, SidebarLayoutProps, SidebarSide }` |
| `TabNav` / `TabLink` | `{ TabNav, TabNavProps, TabLink, TabLinkProps }` |
| `Stack` | `{ Stack, StackProps, StackGap }` |
| `Grid` / `Cell` | `{ Grid, GridProps, GridGap, Cell, CellProps }` |
| `DataTable` | `{ DataTable, DataTableProps, DataTableColumn }` |
| `DataTableFilter` | `{ DataTableFilter, DataTableFilterProps, FilterConfig, applyFilters }` |
| `DataTableTreeFilter` | `{ DataTableTreeFilter, DataTableTreeFilterProps }` |
| `HistogramTimeline` | `{ HistogramTimeline, HistogramTimelineProps, HistogramBar }` |
| `MapView` | `{ MapView, MapViewProps }` |
| `MapLayer` | `{ MapLayer, MapLayerProps }` |
| `MapMarker` | `{ MapMarker, MapMarkerProps }` |
| `MapPopup` | `{ MapPopup, MapPopupProps }` |

Map utilities: `registerPmtilesProtocol`, `buildProtomapsStyle`.

All type exports (`TableSize`, `ColumnAlign`, `SortDirection`, `FilterState`, `TreeFilterNode`, `MapCenter`, `MapBounds`, etc.) are available as named type imports.

## Updating

The tarball is rebuilt on every pipeline run on `master`. To update, re-run `npm install` — npm will fetch the latest artifact. To pin a specific version, reference a specific job ID instead:

```
https://<GITLAB_HOST>/api/v4/projects/<PROJECT_ID>/jobs/<JOB_ID>/artifacts/aspect-react-ui-0.0.0.tgz
```

## AI agent context

If you are an AI coding assistant working in the consuming project, this is a pre-built React component library. Do not attempt to modify its source — it comes from the AI-Boilerplate monorepo. Use the components as documented above. The design system CSS uses CSS layers (`@layer vendor, reset, tokens, utilities, components`) — respect the layer ordering when adding custom styles.
