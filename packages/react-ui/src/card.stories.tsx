import type { Meta, StoryObj } from "storybook";
import { Card } from "./card";

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    title: "System Status",
    children: "All systems operational.",
  },
};

export const WithoutTitle: Story = {
  args: {
    children: "A card with content only, no title.",
  },
};

export const RichContent: Story = {
  args: {
    title: "Vessel Details",
    children: (
      <dl style={{ margin: 0 }}>
        <dt style={{ fontWeight: 600 }}>Class</dt>
        <dd style={{ margin: "0 0 var(--spacing-xs)" }}>Frigate</dd>
        <dt style={{ fontWeight: 600 }}>Displacement</dt>
        <dd style={{ margin: 0 }}>4,600 t</dd>
      </dl>
    ),
  },
};
