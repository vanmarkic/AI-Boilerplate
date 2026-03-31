import type { Meta, StoryObj } from "storybook";
import { Badge } from "./badge";
import { HistogramTimeline } from "./histogram-timeline";
import {
  GROUPS,
  FlatCards,
  GroupedCards,
  generateBars,
  generateLabels,
} from "./scalable-dashboard.story-data";

const bars = generateBars(720, 50);
const labels = generateLabels(720, 60, (i) =>
  `${String(Math.floor(i / 60))}:${String(i % 60).padStart(2, "0")}`,
);

function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div
        style={{
          padding: "var(--spacing-sm) var(--spacing-lg)",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1 className="text-lg font-bold text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Scalable card layout</p>
        </div>
        <Badge variant="outline">Live</Badge>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--spacing-lg)" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-lg)",
            maxWidth: "80rem",
            margin: "0 auto",
          }}
        >
          {children}
        </div>
      </div>

      {/* Histogram footer */}
      <div
        style={{
          borderTop: "1px solid var(--color-border)",
          padding: "var(--spacing-sm) var(--spacing-lg)",
        }}
      >
        <HistogramTimeline
          bars={bars}
          labels={labels}
          ariaLabel="Events per minute (12 hours)"
          variant="default"
        />
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Composed/ScalableDashboard",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

export const FourCards: Story = {
  name: "4 Cards — Flat Grid",
  render: () => (
    <DashboardShell>
      <FlatCards groups={GROUPS.slice(0, 1)} cols={4} />
    </DashboardShell>
  ),
};

export const SixteenCardsGrouped: Story = {
  name: "16 Cards — Grouped (aggregated)",
  render: () => (
    <DashboardShell>
      <GroupedCards groups={GROUPS.slice(0, 4)} defaultMode="aggregated" />
    </DashboardShell>
  ),
};

export const SixteenCardsExpanded: Story = {
  name: "16 Cards — Grouped (expanded)",
  render: () => (
    <DashboardShell>
      <GroupedCards groups={GROUPS.slice(0, 4)} defaultMode="disaggregated" />
    </DashboardShell>
  ),
};

export const SixteenCardsFlat: Story = {
  name: "16 Cards — Flat Grid",
  render: () => (
    <DashboardShell>
      <FlatCards groups={GROUPS.slice(0, 4)} cols={4} />
    </DashboardShell>
  ),
};

export const FortyCardsGrouped: Story = {
  name: "40 Cards — Grouped (aggregated)",
  render: () => (
    <DashboardShell>
      <GroupedCards groups={GROUPS} defaultMode="aggregated" />
    </DashboardShell>
  ),
};

export const FortyCardsExpanded: Story = {
  name: "40 Cards — Grouped (expanded)",
  render: () => (
    <DashboardShell>
      <GroupedCards groups={GROUPS} defaultMode="disaggregated" />
    </DashboardShell>
  ),
};

export const FortyCardsFlat: Story = {
  name: "40 Cards — Flat Grid",
  render: () => (
    <DashboardShell>
      <FlatCards groups={GROUPS} cols={4} />
    </DashboardShell>
  ),
};
