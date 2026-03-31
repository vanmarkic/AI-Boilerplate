import { useState } from "react";
import type { Meta, StoryObj } from "storybook";
import { DrawerPanel } from "./drawer-panel";
import { Button } from "./button";
import { Card } from "./card";
import { Stack } from "./stack";

const meta: Meta<typeof DrawerPanel> = {
  title: "Components/DrawerPanel",
  component: DrawerPanel,
  argTypes: {
    side: {
      control: "select",
      options: ["left", "right"],
    },
    open: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof DrawerPanel>;

export const Right: Story = {
  render: (args: { open?: boolean; side?: "left" | "right" }) => (
    <DrawerPanel open={args.open} side={args.side} title={<span className="text-sm font-semibold">Details</span>}>
      <Stack gap="sm">
        <Card title="Location">San Francisco, CA</Card>
        <Card title="Status">All systems operational.</Card>
      </Stack>
    </DrawerPanel>
  ),
  args: { open: true, side: "right" },
};

export const Left: Story = {
  render: (args: { open?: boolean; side?: "left" | "right" }) => (
    <DrawerPanel open={args.open} side={args.side} title={<span className="text-sm font-semibold">Navigation</span>}>
      <Stack gap="xs">
        <a style={{ display: "block", padding: "0.5rem 0", cursor: "pointer" }}>Dashboard</a>
        <a style={{ display: "block", padding: "0.5rem 0", cursor: "pointer" }}>Analytics</a>
        <a style={{ display: "block", padding: "0.5rem 0", cursor: "pointer" }}>Reports</a>
        <a style={{ display: "block", padding: "0.5rem 0", cursor: "pointer" }}>Settings</a>
      </Stack>
    </DrawerPanel>
  ),
  args: { open: true, side: "left" },
};

export const Closed: Story = {
  args: {
    open: false,
    side: "right",
    title: <span className="text-sm font-semibold">Hidden Panel</span>,
    children: <p>This content is off-screen.</p>,
  },
};

export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Drawer</Button>
        <DrawerPanel
          open={open}
          onClose={() => setOpen(false)}
          title={<span className="text-sm font-semibold">Details</span>}
        >
          <Stack gap="sm">
            <Card title="Location">San Francisco, CA</Card>
            <Card title="Status">All systems operational.</Card>
          </Stack>
        </DrawerPanel>
      </>
    );
  },
};
