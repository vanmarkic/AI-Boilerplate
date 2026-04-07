import type { Meta, StoryObj } from "storybook";
import { TabNav, TabLink } from "./tab-nav";

const meta: Meta<typeof TabNav> = {
  title: "Components/TabNav",
  component: TabNav,
};

export default meta;
type Story = StoryObj<typeof TabNav>;

export const Default: Story = {
  render: () => (
    <TabNav>
      <TabLink href="#" active>Overview</TabLink>
      <TabLink href="#">Details</TabLink>
      <TabLink href="#">History</TabLink>
    </TabNav>
  ),
};

export const NoActiveTab: Story = {
  render: () => (
    <TabNav>
      <TabLink href="#">Tab A</TabLink>
      <TabLink href="#">Tab B</TabLink>
    </TabNav>
  ),
};
