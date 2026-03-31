import type { Meta, StoryObj } from "storybook";
import { MapView } from "./map-view";
import { MapMarker } from "./map-marker";
import { MapPopup } from "./map-popup";

const DEMO_STYLE = "https://demotiles.maplibre.org/style.json";

const meta: Meta<typeof MapView> = {
  title: "Map/MapView",
  component: MapView,
  parameters: { layout: "fullscreen" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "satellite", "muted"],
    },
    interactive: { control: "boolean" },
    zoom: { control: { type: "range", min: 1, max: 18, step: 1 } },
  },
};

export default meta;
type Story = StoryObj<typeof MapView>;

export const Default: Story = {
  args: {
    styleUrl: DEMO_STYLE,
    center: { lng: 2.3522, lat: 48.8566 },
    zoom: 5,
  },
  render: (args) => (
    <div style={{ height: "500px" }}>
      <MapView {...args} />
    </div>
  ),
};

export const WithMarker: Story = {
  render: () => (
    <div style={{ height: "500px" }}>
      <MapView styleUrl={DEMO_STYLE} center={{ lng: 2.3522, lat: 48.8566 }} zoom={10}>
        <MapMarker lngLat={{ lng: 2.3522, lat: 48.8566 }}>
          <div style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "var(--color-primary, #3b82f6)",
            border: "2px solid white",
          }} />
        </MapMarker>
      </MapView>
    </div>
  ),
};

export const WithPopup: Story = {
  render: () => (
    <div style={{ height: "500px" }}>
      <MapView styleUrl={DEMO_STYLE} center={{ lng: 2.3522, lat: 48.8566 }} zoom={10}>
        <MapPopup lngLat={{ lng: 2.3522, lat: 48.8566 }}>
          Paris, France
        </MapPopup>
      </MapView>
    </div>
  ),
};

export const NonInteractive: Story = {
  args: {
    styleUrl: DEMO_STYLE,
    center: { lng: 0, lat: 20 },
    zoom: 2,
    interactive: false,
    variant: "muted",
  },
  render: (args) => (
    <div style={{ height: "300px" }}>
      <MapView {...args} />
    </div>
  ),
};
