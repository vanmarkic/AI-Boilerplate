import type { Meta, StoryObj } from "storybook";
import { CollapsiblePanel } from "./collapsible-panel";
import { Badge } from "./badge";

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

export const Outline: Story = {
  args: {
    variant: "outline",
    open: true,
    header: "Outline variant",
    children: "Content with outline styling.",
  },
};

export const Small: Story = {
  args: { size: "sm", open: true, header: "Small panel", children: "Compact content." },
};

export const Large: Story = {
  args: { size: "lg", open: true, header: "Large panel", children: "Spacious content." },
};

export const AccordionGroup: Story = {
  render: () => (
    <div>
      <CollapsiblePanel open header="Getting Started">
        Welcome to the platform. This section covers the basics of setting up
        your account and navigating the dashboard.
      </CollapsiblePanel>
      <CollapsiblePanel header="Configuration">
        Customize your workspace by adjusting notification preferences, theme
        settings, and integration options.
      </CollapsiblePanel>
      <CollapsiblePanel header="Advanced Settings">
        Fine-tune performance, manage API keys, and configure deployment
        pipelines for your projects.
      </CollapsiblePanel>
    </div>
  ),
};

export const RichContent: Story = {
  render: () => (
    <CollapsiblePanel
      open
      header={
        <span style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)" }}>
          System Status
          <Badge variant="secondary">Live</Badge>
        </span>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>API Server</span>
          <span style={{ color: "var(--color-primary)" }}>Operational</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Database</span>
          <span style={{ color: "var(--color-primary)" }}>Operational</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>CDN</span>
          <span style={{ color: "var(--color-destructive)" }}>Degraded</span>
        </div>
      </div>
    </CollapsiblePanel>
  ),
};

export const NestedPanels: Story = {
  render: () => (
    <CollapsiblePanel open variant="outline" header="Frontend">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
        <CollapsiblePanel variant="ghost" size="sm" open header="Components">
          Shared UI components built with React and the design system.
        </CollapsiblePanel>
        <CollapsiblePanel variant="ghost" size="sm" header="Services">
          Core services for authentication, state management, and API communication.
        </CollapsiblePanel>
      </div>
    </CollapsiblePanel>
  ),
};
