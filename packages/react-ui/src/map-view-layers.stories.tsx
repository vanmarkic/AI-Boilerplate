import type { Meta, StoryObj } from 'storybook';
import { MapView } from './map-view';
import { MapLayer } from './map-layer';
import { MapPopup } from './map-popup';
import type { GeoJSON } from 'geojson';

const DEMO_STYLE = 'https://demotiles.maplibre.org/style.json';

const polygonSource: GeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Golden Gate Park' },
      geometry: {
        type: 'Polygon',
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

const lineSource: GeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Market Street' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-122.419, 37.776],
          [-122.404, 37.79],
        ],
      },
    },
  ],
};

const pointsSource: GeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Ferry Building' },
      geometry: { type: 'Point', coordinates: [-122.394, 37.796] },
    },
    {
      type: 'Feature',
      properties: { name: 'Coit Tower' },
      geometry: { type: 'Point', coordinates: [-122.406, 37.802] },
    },
    {
      type: 'Feature',
      properties: { name: 'City Hall' },
      geometry: { type: 'Point', coordinates: [-122.419, 37.779] },
    },
  ],
};

const meta: Meta = {
  title: 'Map/MapView/Layers & Popups',
  tags: ['!test'],
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

export const WithFillLayer: Story = {
  render: () => (
    <div style={{ width: '100%', height: 400 }}>
      <MapView
        center={{ lng: -122.48, lat: 37.769 }}
        zoom={13}
        styleUrl={DEMO_STYLE}
        ariaLabel="Map with fill layer"
      >
        <MapLayer
          id="park-fill"
          type="fill"
          source={polygonSource}
          paint={{ 'fill-color': '#2ecc71', 'fill-opacity': 0.4 }}
        />
      </MapView>
    </div>
  ),
};

export const WithLineLayer: Story = {
  render: () => (
    <div style={{ width: '100%', height: 400 }}>
      <MapView
        center={{ lng: -122.41, lat: 37.783 }}
        zoom={14}
        styleUrl={DEMO_STYLE}
        ariaLabel="Map with line layer"
      >
        <MapLayer
          id="route-line"
          type="line"
          source={lineSource}
          paint={{ 'line-color': '#e74c3c', 'line-width': 4 }}
        />
      </MapView>
    </div>
  ),
};

export const WithCircleLayer: Story = {
  render: () => (
    <div style={{ width: '100%', height: 400 }}>
      <MapView
        center={{ lng: -122.406, lat: 37.79 }}
        zoom={13}
        styleUrl={DEMO_STYLE}
        ariaLabel="Map with circle layer"
      >
        <MapLayer
          id="points-circle"
          type="circle"
          source={pointsSource}
          paint={{
            'circle-radius': 8,
            'circle-color': '#3498db',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          }}
        />
      </MapView>
    </div>
  ),
};

export const WithPopup: Story = {
  render: () => (
    <div style={{ width: '100%', height: 400 }}>
      <MapView
        center={{ lng: -73.98, lat: 40.75 }}
        zoom={13}
        styleUrl={DEMO_STYLE}
        ariaLabel="Map with popup"
      >
        <MapPopup
          lngLat={{ lng: -73.98, lat: 40.75 }}
          variant="default"
          anchor="bottom"
          offset={12}
        >
          <p style={{ margin: 0, padding: 8 }}>Times Square, New York</p>
        </MapPopup>
      </MapView>
    </div>
  ),
};

export const WithTooltip: Story = {
  render: () => (
    <div style={{ width: '100%', height: 400 }}>
      <MapView
        center={{ lng: -73.98, lat: 40.75 }}
        zoom={13}
        styleUrl={DEMO_STYLE}
        ariaLabel="Map with tooltip"
      >
        <MapPopup lngLat={{ lng: -73.98, lat: 40.75 }} variant="tooltip" anchor="bottom" offset={8}>
          <span>Hover info</span>
        </MapPopup>
      </MapView>
    </div>
  ),
};
