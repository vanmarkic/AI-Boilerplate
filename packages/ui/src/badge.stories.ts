import type { Meta, StoryObj } from '@storybook/angular';
import { BadgeComponent } from './badge.component';

const meta: Meta<BadgeComponent & { label: string }> = {
  title: 'UI/Badge',
  component: BadgeComponent,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'secondary', 'destructive', 'outline'] },
    label: { control: 'text' },
  },
  args: {
    label: 'Badge',
    variant: 'default',
  },
  render: (args) => ({
    props: args,
    template: `<ui-badge [variant]="variant">{{ label }}</ui-badge>`,
    moduleMetadata: { imports: [BadgeComponent] },
  }),
};
export default meta;

type Story = StoryObj<BadgeComponent & { label: string }>;

export const Default: Story = { args: { label: 'New', variant: 'default' } };
export const Secondary: Story = { args: { label: 'In progress', variant: 'secondary' } };
export const Destructive: Story = { args: { label: 'Error', variant: 'destructive' } };
export const Outline: Story = { args: { label: 'v2.1.0', variant: 'outline' } };
