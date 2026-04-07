import type { Meta, StoryObj } from "storybook";
import { MapView } from "./map-view";
import { MapLayer } from "./map-layer";
import type { GeoJSON } from "geojson";

const DEMO_STYLE = "https://demotiles.maplibre.org/style.json";

const pointSource: GeoJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [2.3522, 48.8566] },
      properties: { name: "Paris" },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-3.7038, 40.4168] },
      properties: { name: "Madrid" },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [12.4964, 41.9028] },
      properties: { name: "Rome" },
    },
  ],
};

const meta: Meta<typeof MapLayer> = {
  title: "Map/MapLayer",
  component: MapLayer,
  tags: ["!test"],
};

export default meta;
type Story = StoryObj<typeof MapLayer>;

export const CircleLayer: Story = {
  render: () => (
    <div style={{ height: "500px" }}>
      <MapView styleUrl={DEMO_STYLE} center={{ lng: 5, lat: 45 }} zoom={4}>
        <MapLayer
          id="cities"
          type="circle"
          source={pointSource}
          paint={{
            "circle-radius": 8,
            "circle-color": "#3b82f6",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          }}
        />
      </MapView>
    </div>
  ),
};
