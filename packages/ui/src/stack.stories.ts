import type { Meta, StoryObj } from '@storybook/angular';
import { CardComponent } from './card.component';
import { StackComponent } from './stack.component';

const meta: Meta<StackComponent> = {
  title: 'Layout/Stack',
  component: StackComponent,
  tags: ['autodocs'],
  argTypes: {
    direction: { control: 'select', options: ['vertical', 'horizontal'] },
    gap: { control: 'select', options: ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] },
    align: { control: 'select', options: [null, 'start', 'center', 'end', 'stretch'] },
    justify: { control: 'select', options: [null, 'start', 'center', 'end', 'between'] },
  },
  render: (args) => ({
    props: args,
    template: `
      <ui-stack [direction]="direction" [gap]="gap" [align]="align" [justify]="justify">
        <ui-card title="Item A">First stack item</ui-card>
        <ui-card title="Item B">Second stack item</ui-card>
        <ui-card title="Item C">Third stack item</ui-card>
      </ui-stack>
    `,
    moduleMetadata: { imports: [StackComponent, CardComponent] },
  }),
};
export default meta;

type Story = StoryObj<StackComponent>;

export const Vertical: Story = {
  args: { direction: 'vertical', gap: 'md' },
};

export const Horizontal: Story = {
  args: { direction: 'horizontal', gap: 'md' },
};

export const TightGap: Story = {
  args: { direction: 'vertical', gap: 'xs' },
};

export const SpreadBetween: Story = {
  args: { direction: 'horizontal', gap: 'md', justify: 'between' },
};

export const Centered: Story = {
  args: { direction: 'vertical', gap: 'md', align: 'center' },
};
