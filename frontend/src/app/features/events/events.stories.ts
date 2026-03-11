import type { Meta, StoryObj } from '@storybook/angular';
import { EventsComponent } from './events.component';

const meta: Meta<EventsComponent> = {
  title: 'Features/Events',
  component: EventsComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EventsTimeline: Story = {
  render: (args) => ({
    props: args,
    template: '<app-events></app-events>',
  }),
};
