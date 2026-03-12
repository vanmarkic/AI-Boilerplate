import type { Meta, StoryObj } from '@storybook/angular';
import { CardComponent } from './card.component';

const meta: Meta<CardComponent & { content: string }> = {
  title: 'UI/Card',
  component: CardComponent,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    content: { control: 'text' },
  },
  args: {
    title: 'Card Title',
    content: 'This is the card body. You can place any content here, including text, images, or other components.',
  },
  render: (args) => ({
    props: args,
    template: `<app-card [title]="title">{{ content }}</app-card>`,
    moduleMetadata: { imports: [CardComponent] },
  }),
};
export default meta;

type Story = StoryObj<CardComponent & { content: string }>;

export const Default: Story = {
  args: {
    title: 'Monthly Revenue',
    content: 'Total revenue for March reached $48,250, a 12% increase over the previous month.',
  },
};

export const WithoutTitle: Story = {
  args: {
    title: '',
    content: 'A card without a title can be used for simple content blocks or callouts.',
  },
};
