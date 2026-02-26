import type { Meta, StoryObj } from '@storybook/angular';
import { InputComponent } from './input.component';

const meta: Meta<InputComponent> = {
  title: 'UI/Input',
  component: InputComponent,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<InputComponent>;

export const Default: Story = { args: { placeholder: 'Enter text...' } };
export const WithLabel: Story = { args: { label: 'Email', type: 'email', placeholder: 'you@example.com' } };
export const Password: Story = { args: { label: 'Password', type: 'password' } };
