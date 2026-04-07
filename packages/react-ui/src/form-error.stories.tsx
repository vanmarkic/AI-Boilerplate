import type { Meta, StoryObj } from 'storybook';
import { FormError } from './form-error';

const meta: Meta<typeof FormError> = {
  title: 'Components/FormError',
  component: FormError,
};

export default meta;
type Story = StoryObj<typeof FormError>;

export const Required: Story = {
  args: { errors: { required: true }, touched: true },
};

export const Email: Story = {
  args: { errors: { email: true }, touched: true },
};

export const MultipleErrors: Story = {
  args: {
    errors: { required: true, minlength: { requiredLength: 3 } },
    touched: true,
  },
};

export const Untouched: Story = {
  args: { errors: { required: true }, touched: false },
};
