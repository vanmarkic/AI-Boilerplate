import type { Meta, StoryObj } from '@storybook/angular';
import { CardComponent } from './card.component';

const meta: Meta<CardComponent> = {
  title: 'UI/Card',
  component: CardComponent,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<CardComponent>;

export const Default: Story = { args: { title: 'Card Title' } };
export const WithoutTitle: Story = { args: {} };
