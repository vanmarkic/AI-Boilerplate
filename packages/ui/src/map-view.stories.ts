import type { Meta, StoryObj } from '@storybook/angular';
import { MapViewComponent } from './map-view.component';

const meta: Meta<MapViewComponent> = {
  title: 'UI/MapView',
  component: MapViewComponent,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'satellite', 'muted'],
    },
    zoom: {
      control: { type: 'range', min: 0, max: 20, step: 0.5 },
    },
    interactive: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<MapViewComponent>;

export const Default: Story = {
  args: {
    center: { lng: -122.4, lat: 37.8 },
    zoom: 10,
    styleUrl: 'https://demotiles.maplibre.org/style.json',
    ariaLabel: 'Map of San Francisco Bay Area',
    variant: 'default',
  },
};

export const MutedVariant: Story = {
  args: {
    center: { lng: -73.98, lat: 40.75 },
    zoom: 12,
    styleUrl: 'https://demotiles.maplibre.org/style.json',
    ariaLabel: 'Map of Manhattan',
    variant: 'muted',
  },
};

export const SatelliteVariant: Story = {
  args: {
    center: { lng: 2.35, lat: 48.86 },
    zoom: 14,
    styleUrl: 'https://demotiles.maplibre.org/style.json',
    ariaLabel: 'Satellite view of Paris',
    variant: 'satellite',
  },
};

export const NonInteractive: Story = {
  args: {
    center: { lng: 139.69, lat: 35.69 },
    zoom: 8,
    styleUrl: 'https://demotiles.maplibre.org/style.json',
    ariaLabel: 'Static map of Tokyo',
    variant: 'default',
    interactive: false,
  },
};

export const CustomColors: Story = {
  args: {
    center: { lng: -0.12, lat: 51.51 },
    zoom: 11,
    styleUrl: 'https://demotiles.maplibre.org/style.json',
    ariaLabel: 'Map of London with custom colors',
    variant: 'default',
    colors: {
      water: 'oklch(20% 0.06 250)',
      land: 'oklch(15% 0.01 250)',
      roads: 'oklch(30% 0.02 245)',
    },
  },
};
