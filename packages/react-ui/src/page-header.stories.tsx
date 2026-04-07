import type { Meta, StoryObj } from 'storybook';
import { PageHeader } from './page-header';
import { Button } from './button';

const meta: Meta<typeof PageHeader> = {
  title: 'Layout/PageHeader',
  component: PageHeader,
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const TitleOnly: Story = {
  args: { title: 'Dashboard' },
};

export const WithSubtitle: Story = {
  args: { title: 'Fleet Overview', subtitle: 'Real-time vessel tracking' },
};

export const WithActions: Story = {
  args: {
    title: 'Fleet Overview',
    subtitle: 'Real-time vessel tracking',
    actions: <Button>Export</Button>,
  },
};
