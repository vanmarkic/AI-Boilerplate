import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { MapMarkerComponent } from './map-marker.component';
import { MapViewComponent } from './map-view.component';

const meta: Meta<MapMarkerComponent> = {
  title: 'UI/MapMarker',
  component: MapMarkerComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({ imports: [MapViewComponent, MapMarkerComponent] }),
  ],
  argTypes: {
    draggable: { control: 'boolean' },
    anchor: {
      control: 'select',
      options: [
        'center',
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
  },
};
export default meta;

type Story = StoryObj<MapMarkerComponent>;

export const Default: Story = {
  render: (args) => ({
    props: {
      ...args,
      center: args.lngLat ?? { lng: -122.4, lat: 37.8 },
    },
    template: `
      <ui-map-view
        [center]="center"
        [zoom]="12"
        styleUrl="https://demotiles.maplibre.org/style.json"
        ariaLabel="Map with marker"
        style="width: 100%; height: 400px; display: block;">
        <ui-map-marker [lngLat]="center" [draggable]="draggable" [anchor]="anchor">
          <div style="width: 24px; height: 24px; background: var(--color-primary, #e74c3c); border-radius: 50%; border: 2px solid white;"></div>
        </ui-map-marker>
      </ui-map-view>
    `,
  }),
  args: {
    lngLat: { lng: -122.4, lat: 37.8 },
    draggable: false,
    anchor: 'center',
  },
};

export const Draggable: Story = {
  render: (args) => ({
    props: {
      ...args,
      center: args.lngLat ?? { lng: -73.98, lat: 40.75 },
    },
    template: `
      <ui-map-view
        [center]="center"
        [zoom]="13"
        styleUrl="https://demotiles.maplibre.org/style.json"
        ariaLabel="Map with draggable marker"
        style="width: 100%; height: 400px; display: block;">
        <ui-map-marker [lngLat]="center" [draggable]="true" [anchor]="anchor">
          <div style="width: 24px; height: 24px; background: var(--color-primary, #3498db); border-radius: 50%; border: 2px solid white; cursor: grab;"></div>
        </ui-map-marker>
      </ui-map-view>
    `,
  }),
  args: {
    lngLat: { lng: -73.98, lat: 40.75 },
    draggable: true,
    anchor: 'center',
  },
};

export const MultipleMarkers: Story = {
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
