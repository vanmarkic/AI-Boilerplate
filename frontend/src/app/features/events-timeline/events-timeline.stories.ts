import type { Meta, StoryObj } from '@storybook/angular';
import { EventsTimelineComponent } from './events-timeline.component';

const meta: Meta<EventsTimelineComponent> = {
  title: 'Pages/Events Timeline',
  component: EventsTimelineComponent,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;

type Story = StoryObj<EventsTimelineComponent>;

export const Default: Story = {};
