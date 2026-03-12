import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { ButtonComponent } from './button.component';
import { ButtonDirective } from './button.directive';

const meta: Meta<ButtonComponent & { label: string }> = {
  title: 'UI/Button',
  component: ButtonComponent,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'destructive', 'outline', 'ghost'] },
    size: { control: 'select', options: ['sm', 'default', 'lg'] },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
  },
  args: {
    label: 'Button',
    variant: 'default',
    size: 'default',
    disabled: false,
  },
  render: (args) => ({
    props: args,
    template: `
      <asp-button [variant]="variant" [size]="size" [disabled]="disabled">{{ label }}</asp-button>
    `,
    moduleMetadata: { imports: [ButtonComponent] },
  }),
};
export default meta;

type Story = StoryObj<ButtonComponent & { label: string }>;

export const Default: Story = { args: { label: 'Button', variant: 'default', size: 'default' } };
export const Destructive: Story = { args: { label: 'Delete', variant: 'destructive' } };
export const Outline: Story = { args: { label: 'Cancel', variant: 'outline' } };
export const Ghost: Story = { args: { label: 'More options', variant: 'ghost' } };
export const Small: Story = { args: { label: 'Small', size: 'sm' } };
export const Large: Story = { args: { label: 'Get started', size: 'lg' } };
export const Disabled: Story = { args: { label: 'Unavailable', disabled: true } };

export const DirectiveUsage: StoryObj = {
  decorators: [moduleMetadata({ imports: [ButtonDirective] })],
  render: () => ({
    template: `
      <div style="display: flex; gap: 8px; align-items: center;">
        <button aspButton>Default</button>
        <button aspButton variant="destructive">Destructive</button>
        <button aspButton variant="outline">Outline</button>
        <button aspButton variant="ghost">Ghost</button>
      </div>
    `,
  }),
};
