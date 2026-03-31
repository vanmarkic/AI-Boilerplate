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
