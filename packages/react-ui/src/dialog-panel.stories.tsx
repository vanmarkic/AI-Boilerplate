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
