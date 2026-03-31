import type { Meta, StoryObj } from "storybook";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "Components/Input",
  component: Input,
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { label: "Email" },
};

export const WithPlaceholder: Story = {
  args: { label: "Name", placeholder: "Enter your name" },
};

export const Disabled: Story = {
  args: { label: "Locked", value: "Read only", disabled: true },
};
