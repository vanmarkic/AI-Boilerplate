import type { Meta, StoryObj } from '@storybook/angular';
import { MapPopupComponent } from './map-popup.component';

const meta: Meta<MapPopupComponent> = {
  title: 'UI/MapPopup',
  component: MapPopupComponent,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'tooltip'],
    },
    anchor: {
      control: 'select',
      options: [
        'top',
        'bottom',
        'left',
        'right',
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
      ],
    },
    offset: {
      control: { type: 'range', min: 0, max: 40, step: 2 },
    },
  },
};
export default meta;

type Story = StoryObj<MapPopupComponent>;

export const Default: Story = {
  args: {
    lngLat: { lng: -73.98, lat: 40.75 },
    variant: 'default',
    anchor: 'bottom',
    offset: 12,
  },
};

export const Tooltip: Story = {
  args: {
    lngLat: { lng: -73.98, lat: 40.75 },
    variant: 'tooltip',
    anchor: 'bottom',
    offset: 8,
  },
};
