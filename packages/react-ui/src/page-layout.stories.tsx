import type { Meta, StoryObj } from "storybook";
import { PageLayout } from "./page-layout";
import { PageHeader } from "./page-header";
import { Grid } from "./grid";
import { Card } from "./card";
import { Button } from "./button";
import { Stack } from "./stack";

const meta: Meta<typeof PageLayout> = {
  title: "Layout/PageLayout",
  component: PageLayout,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof PageLayout>;

export const Default: Story = {
  render: () => (
    <PageLayout
      header={
        <div style={{ paddingInline: "1.5rem", borderBottom: "1px solid var(--color-border)" }}>
          <PageHeader title="Dashboard" subtitle="Overview of your workspace" actions={<Button>New Report</Button>} />
        </div>
      }
      footer={
        <div
          style={{
            padding: "1rem",
            borderTop: "1px solid var(--color-border)",
            textAlign: "center",
          }}
          className="text-sm text-muted-foreground"
        >
          &copy; 2025 Acme Corp
        </div>
      }
    >
      <div style={{ padding: "1.5rem" }}>
        <Grid columns={3} gap="md">
          <Card title="Total Users">4,320 active accounts this month.</Card>
          <Card title="Revenue">$128,400 — up 8% from last period.</Card>
          <Card title="Open Issues">12 items require attention.</Card>
        </Grid>
      </div>
    </PageLayout>
  ),
};

export const WithoutFooter: Story = {
  render: () => (
    <PageLayout
      header={
        <div style={{ paddingInline: "1.5rem", borderBottom: "1px solid var(--color-border)" }}>
          <PageHeader title="Analytics" subtitle="Track performance metrics" />
        </div>
      }
    >
      <div style={{ padding: "1.5rem" }}>
        <Stack gap="md">
          <Card title="Sessions">14,820 sessions recorded this week.</Card>
          <Card title="Bounce Rate">42% average across all pages.</Card>
        </Stack>
      </div>
    </PageLayout>
  ),
};

export const ContentOnly: Story = {
  args: {
    children: <div style={{ padding: "var(--spacing-md)" }}>No header or footer</div>,
  },
};
