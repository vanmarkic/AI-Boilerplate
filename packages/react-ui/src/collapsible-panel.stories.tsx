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
