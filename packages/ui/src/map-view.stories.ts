import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { MapViewComponent } from './map-view.component';
import { MapLayerComponent } from './map-layer.component';
import { MapMarkerComponent } from './map-marker.component';
import { MapPopupComponent } from './map-popup.component';

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

// --- Composed: Layers ---

const polygonSource = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: { name: 'Golden Gate Park' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [-122.511, 37.771],
            [-122.454, 37.771],
            [-122.454, 37.766],
            [-122.511, 37.766],
            [-122.511, 37.771],
          ],
        ],
      },
    },
  ],
};

const lineSource = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: { name: 'Market Street' },
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [-122.419, 37.776],
          [-122.404, 37.790],
        ],
      },
    },
  ],
};

const pointsSource = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: { name: 'Ferry Building' },
      geometry: { type: 'Point' as const, coordinates: [-122.394, 37.796] },
    },
    {
      type: 'Feature' as const,
      properties: { name: 'Coit Tower' },
      geometry: { type: 'Point' as const, coordinates: [-122.406, 37.802] },
    },
    {
      type: 'Feature' as const,
      properties: { name: 'City Hall' },
      geometry: { type: 'Point' as const, coordinates: [-122.419, 37.779] },
    },
  ],
};

export const WithFillLayer: Story = {
  tags: ['!autodocs'],
  render: () => ({
    props: {
      center: { lng: -122.48, lat: 37.769 },
      source: polygonSource,
    },
    template: `
      <ui-map-view
        [center]="center"
        [zoom]="13"
        styleUrl="https://demotiles.maplibre.org/style.json"
        ariaLabel="Map with fill layer"
        style="width: 100%; height: 400px; display: block;">
        <ui-map-layer
          id="park-fill"
          type="fill"
          [source]="source"
          [paint]="{ 'fill-color': '#2ecc71', 'fill-opacity': 0.4 }"
        />
      </ui-map-view>
    `,
  }),
};

export const WithLineLayer: Story = {
  tags: ['!autodocs'],
  render: () => ({
    props: {
      center: { lng: -122.41, lat: 37.783 },
      source: lineSource,
    },
    template: `
      <ui-map-view
        [center]="center"
        [zoom]="14"
        styleUrl="https://demotiles.maplibre.org/style.json"
        ariaLabel="Map with line layer"
        style="width: 100%; height: 400px; display: block;">
        <ui-map-layer
          id="route-line"
          type="line"
          [source]="source"
          [paint]="{ 'line-color': '#e74c3c', 'line-width': 4 }"
        />
      </ui-map-view>
    `,
  }),
};

export const WithCircleLayer: Story = {
  tags: ['!autodocs'],
  render: () => ({
    props: {
      center: { lng: -122.406, lat: 37.79 },
      source: pointsSource,
    },
    template: `
      <ui-map-view
        [center]="center"
        [zoom]="13"
        styleUrl="https://demotiles.maplibre.org/style.json"
        ariaLabel="Map with circle layer"
        style="width: 100%; height: 400px; display: block;">
        <ui-map-layer
          id="points-circle"
          type="circle"
          [source]="source"
          [paint]="{ 'circle-radius': 8, 'circle-color': '#3498db', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' }"
        />
      </ui-map-view>
    `,
  }),
};

// --- Composed: Popup ---

export const WithPopup: Story = {
  tags: ['!autodocs'],
  render: () => ({
    props: {
      center: { lng: -73.98, lat: 40.75 },
    },
    template: `
      <ui-map-view
        [center]="center"
        [zoom]="13"
        styleUrl="https://demotiles.maplibre.org/style.json"
        ariaLabel="Map with popup"
        style="width: 100%; height: 400px; display: block;">
        <ui-map-popup [lngLat]="center" variant="default" anchor="bottom" [offset]="12">
          <p style="margin: 0; padding: 8px;">Times Square, New York</p>
        </ui-map-popup>
      </ui-map-view>
    `,
  }),
};

export const WithTooltip: Story = {
  tags: ['!autodocs'],
  render: () => ({
    props: {
      center: { lng: -73.98, lat: 40.75 },
    },
    template: `
      <ui-map-view
        [center]="center"
        [zoom]="13"
        styleUrl="https://demotiles.maplibre.org/style.json"
        ariaLabel="Map with tooltip"
        style="width: 100%; height: 400px; display: block;">
        <ui-map-popup [lngLat]="center" variant="tooltip" anchor="bottom" [offset]="8">
          <span>Hover info</span>
        </ui-map-popup>
      </ui-map-view>
    `,
  }),
};
