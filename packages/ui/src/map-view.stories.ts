import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { MapViewComponent } from './map-view.component';
import { MapLayerComponent } from './map-layer.component';
import { MapMarkerComponent } from './map-marker.component';
import { MapPopupComponent } from './map-popup.component';
import { resolveColors, buildProtomapsStyle } from './map-view.style-builder';

const meta: Meta<MapViewComponent> = {
  title: 'UI/MapView',
  component: MapViewComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [MapViewComponent, MapLayerComponent, MapMarkerComponent, MapPopupComponent],
    }),
  ],
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
  tags: ['!autodocs'],
  args: {
    center: { lng: -73.98, lat: 40.75 },
    zoom: 12,
    styleUrl: 'https://demotiles.maplibre.org/style.json',
    ariaLabel: 'Map of Manhattan',
    variant: 'muted',
  },
};

export const SatelliteVariant: Story = {
  tags: ['!autodocs'],
  args: {
    center: { lng: 2.35, lat: 48.86 },
    zoom: 14,
    styleUrl: 'https://demotiles.maplibre.org/style.json',
    ariaLabel: 'Satellite view of Paris',
    variant: 'satellite',
  },
};

export const NonInteractive: Story = {
  tags: ['!autodocs'],
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
  tags: ['!autodocs'],
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

// --- Composed: Markers ---

export const WithMarker: Story = {
  render: (args) => ({
    props: {
      ...args,
      markerPos: args.center ?? { lng: -122.4, lat: 37.8 },
    },
    template: `
      <ui-map-view
        [center]="markerPos"
        [zoom]="12"
        styleUrl="https://demotiles.maplibre.org/style.json"
        ariaLabel="Map with marker"
        style="width: 100%; height: 400px; display: block;">
        <ui-map-marker [lngLat]="markerPos">
          <div style="width: 24px; height: 24px; background: var(--color-primary, #e74c3c); border-radius: 50%; border: 2px solid white;"></div>
        </ui-map-marker>
      </ui-map-view>
    `,
  }),
  args: {
    center: { lng: -122.4, lat: 37.8 },
  },
};

export const WithDraggableMarker: Story = {
  tags: ['!autodocs'],
  render: (args) => ({
    props: {
      ...args,
      markerPos: args.center ?? { lng: -73.98, lat: 40.75 },
    },
    template: `
      <ui-map-view
        [center]="markerPos"
        [zoom]="13"
        styleUrl="https://demotiles.maplibre.org/style.json"
        ariaLabel="Map with draggable marker"
        style="width: 100%; height: 400px; display: block;">
        <ui-map-marker [lngLat]="markerPos" [draggable]="true">
          <div style="width: 24px; height: 24px; background: var(--color-primary, #3498db); border-radius: 50%; border: 2px solid white; cursor: grab;"></div>
        </ui-map-marker>
      </ui-map-view>
    `,
  }),
  args: {
    center: { lng: -73.98, lat: 40.75 },
  },
};

export const WithMultipleMarkers: Story = {
  tags: ['!autodocs'],
  render: () => ({
    props: {
      center: { lng: -122.42, lat: 37.77 },
      markers: [
        { lng: -122.42, lat: 37.77 },
        { lng: -122.40, lat: 37.79 },
        { lng: -122.44, lat: 37.76 },
      ],
    },
    template: `
      <ui-map-view
        [center]="center"
        [zoom]="12"
        styleUrl="https://demotiles.maplibre.org/style.json"
        ariaLabel="Map with multiple markers"
        style="width: 100%; height: 400px; display: block;">
        @for (m of markers; track m.lng) {
          <ui-map-marker [lngLat]="m">
            <div style="width: 20px; height: 20px; background: var(--color-primary, #e74c3c); border-radius: 50%; border: 2px solid white;"></div>
          </ui-map-marker>
        }
      </ui-map-view>
    `,
  }),
};

// --- Protomaps: self-hosted vector tiles ---

const FIRENZE_TILES =
  'https://pmtiles.io/protomaps(vector)ODbL_firenze.pmtiles';

const protomapsStyle = buildProtomapsStyle(
  resolveColors(document.documentElement, {}),
  { tileUrl: FIRENZE_TILES },
);

export const Protomaps: Story = {
  args: {
    center: { lng: 11.255, lat: 43.77 },
    zoom: 13,
    styleUrl: protomapsStyle,
    ariaLabel: 'Protomaps vector map of Florence',
    variant: 'default',
  },
};

export const ProtomapsWithMarker: Story = {
  tags: ['!autodocs'],
  render: () => ({
    props: {
      center: { lng: 11.255, lat: 43.77 },
      style: protomapsStyle,
      markerPos: { lng: 11.255, lat: 43.77 },
    },
    template: `
      <ui-map-view
        [center]="center"
        [zoom]="14"
        [styleUrl]="style"
        ariaLabel="Protomaps Florence with marker"
        style="width: 100%; height: 400px; display: block;">
        <ui-map-marker [lngLat]="markerPos">
          <div style="width: 24px; height: 24px; background: var(--color-primary); border-radius: 50%; border: 2px solid white;"></div>
        </ui-map-marker>
      </ui-map-view>
    `,
  }),
};
