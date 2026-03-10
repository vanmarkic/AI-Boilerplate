import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { ButtonComponent } from './button.component';
import { ButtonDirective } from './button.directive';

const meta: Meta<ButtonComponent> = {
  title: 'UI/Button',
  component: ButtonComponent,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'destructive', 'outline', 'ghost'] },
    size: { control: 'select', options: ['sm', 'default', 'lg'] },
    disabled: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<ButtonComponent>;

export const Default: Story = { args: { variant: 'default', size: 'default' } };
export const Destructive: Story = { args: { variant: 'destructive' } };
export const Outline: Story = { args: { variant: 'outline' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Small: Story = { args: { size: 'sm' } };
export const Large: Story = { args: { size: 'lg' } };
export const Disabled: Story = { args: { disabled: true } };

export const DirectiveUsage: StoryObj = {
  decorators: [moduleMetadata({ imports: [ButtonDirective] })],
  render: () => ({
    template: `
      <div style="display: flex; gap: 8px; align-items: center;">
        <button appButton>Default</button>
        <button appButton variant="destructive">Destructive</button>
        <button appButton variant="outline">Outline</button>
        <button appButton variant="ghost">Ghost</button>
      </div>
    `,
  }),
};
