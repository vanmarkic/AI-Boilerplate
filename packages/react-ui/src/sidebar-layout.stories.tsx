import type { Meta, StoryObj } from "storybook";
import { SidebarLayout } from "./sidebar-layout";
import { PageHeader } from "./page-header";
import { Grid } from "./grid";
import { Card } from "./card";
import { Button } from "./button";
import { Stack } from "./stack";

const NAV_ITEMS = ["Dashboard", "Analytics", "Reports", "Settings"];

const meta: Meta<typeof SidebarLayout> = {
  title: "Layout/SidebarLayout",
  component: SidebarLayout,
  parameters: { layout: "fullscreen" },
  argTypes: {
    side: {
      control: "select",
      options: ["left", "right"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof SidebarLayout>;

export const LeftSidebar: Story = {
  render: () => (
    <div style={{ height: "100dvh" }}>
      <SidebarLayout
        side="left"
        sidebar={
          <nav style={{ padding: "1rem", borderRight: "1px solid var(--color-border)", height: "100%" }}>
            <Stack gap="xs">
              {NAV_ITEMS.map((item) => (
                <a key={item} style={{ display: "block", padding: "0.5rem 1rem", borderRadius: 4, cursor: "pointer" }}>
                  {item}
                </a>
              ))}
            </Stack>
          </nav>
        }
      >
        <div style={{ padding: "1.5rem" }}>
          <PageHeader title="Dashboard" subtitle="Your workspace overview" actions={<Button variant="outline">Export</Button>} />
          <Grid columns={2} gap="md">
            <Card title="Active Projects">23 projects in progress.</Card>
            <Card title="Team Members">8 contributors active today.</Card>
          </Grid>
        </div>
      </SidebarLayout>
    </div>
  ),
};

export const RightSidebar: Story = {
  render: () => (
    <div style={{ height: "100dvh" }}>
      <SidebarLayout
        side="right"
        sidebar={
          <aside style={{ padding: "1rem", borderLeft: "1px solid var(--color-border)" }}>
            <Stack gap="sm">
              <p className="text-sm font-semibold">Filters</p>
              <p className="text-sm text-muted-foreground">Quarter</p>
              <p className="text-sm text-muted-foreground">Region</p>
              <p className="text-sm text-muted-foreground">Product</p>
            </Stack>
          </aside>
        }
      >
        <div style={{ padding: "1.5rem" }}>
          <PageHeader title="Reports" />
          <Stack gap="md">
            <Card title="Q1 Summary">Revenue exceeded targets by 14%.</Card>
            <Card title="Q2 Forecast">Projected growth of 9% based on current pipeline.</Card>
          </Stack>
        </div>
      </SidebarLayout>
    </div>
  ),
};
