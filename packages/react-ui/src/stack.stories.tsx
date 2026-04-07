import type { Meta, StoryObj } from 'storybook';
import { Stack } from './stack';

const Box = ({ children }: { children: string }) => (
  <div
    style={{
      padding: 'var(--spacing-sm)',
      background: 'var(--color-muted)',
      borderRadius: 'var(--radius-sm)',
    }}
  >
    {children}
  </div>
);

const meta: Meta<typeof Stack> = {
  title: 'Layout/Stack',
  component: Stack,
  argTypes: {
    direction: { control: 'select', options: ['vertical', 'horizontal'] },
    gap: { control: 'select', options: ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] },
    align: { control: 'select', options: ['start', 'center', 'end', 'stretch'] },
    justify: { control: 'select', options: ['start', 'center', 'end', 'between'] },
  },
};

export default meta;
type Story = StoryObj<typeof Stack>;

export const Vertical: Story = {
  render: (args) => (
    <Stack {...args}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Stack>
  ),
  args: { direction: 'vertical', gap: 'md' },
};

export const Horizontal: Story = {
  render: (args) => (
    <Stack {...args}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Stack>
  ),
  args: { direction: 'horizontal', gap: 'md' },
};

export const SpaceBetween: Story = {
  render: (args) => (
    <Stack {...args}>
      <Box>Left</Box>
      <Box>Right</Box>
    </Stack>
  ),
  args: { direction: 'horizontal', justify: 'between' },
};
