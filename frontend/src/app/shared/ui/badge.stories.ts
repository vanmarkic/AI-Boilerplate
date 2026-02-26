import type { Meta, StoryObj } from '@storybook/angular';
import { BadgeComponent } from './badge.component';

const meta: Meta<BadgeComponent> = {
  title: 'UI/Badge',
  component: BadgeComponent,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'secondary', 'destructive', 'outline'] },
  },
};
export default meta;

type Story = StoryObj<BadgeComponent>;

export const Default: Story = { args: { variant: 'default' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Destructive: Story = { args: { variant: 'destructive' } };
export const Outline: Story = { args: { variant: 'outline' } };
