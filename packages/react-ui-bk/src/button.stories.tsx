import type { Meta, StoryObj } from "storybook";
import { expect, fn, userEvent, within } from "storybook/test";
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

export const ClickInteraction: Story = {
  args: { children: "Click me", onClick: fn() },
  play: async ({ canvasElement, args }: { canvasElement: HTMLElement; args: Record<string, unknown> }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Click me" });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const DisabledButton: Story = {
  args: { children: "Disabled", disabled: true, onClick: fn() },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Disabled" });
    await expect(button).toBeDisabled();
  },
};
