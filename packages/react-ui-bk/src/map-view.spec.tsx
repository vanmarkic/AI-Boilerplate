import { render, screen } from '@testing-library/react';
import { MapView } from './map-view';

const mockMap = {
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  remove: vi.fn(),
  getCenter: vi.fn(() => ({ lng: 0, lat: 0 })),
  getBounds: vi.fn(() => ({
    getNorth: () => 1,
    getSouth: () => -1,
    getEast: () => 1,
    getWest: () => -1,
  })),
  getZoom: vi.fn(() => 2),
  getCanvas: vi.fn(() => ({ style: {} })),
  easeTo: vi.fn(),
  addSource: vi.fn(),
  addLayer: vi.fn(),
  removeSource: vi.fn(),
  removeLayer: vi.fn(),
  getSource: vi.fn(),
  getLayer: vi.fn(),
  setPaintProperty: vi.fn(),
  setLayoutProperty: vi.fn(),
};

vi.mock('./map-view.init', () => ({
  createMap: vi.fn(() => mockMap),
}));

describe('MapView', () => {
  it('renders with map-view class', () => {
    render(<MapView styleUrl="https://example.com/style.json" />);
    const el = screen.getByRole('application');
    expect(el).toHaveClass('map-view');
  });

  it('renders with default aria-label', () => {
    render(<MapView styleUrl="https://example.com/style.json" />);
    expect(screen.getByRole('application')).toHaveAttribute(
      'aria-label',
      'Interactive map',
    );
  });

  it('accepts custom aria-label', () => {
    render(
      <MapView styleUrl="https://example.com/style.json" ariaLabel="Fleet map" />,
    );
    expect(screen.getByRole('application')).toHaveAttribute(
      'aria-label',
      'Fleet map',
    );
  });

  it('sets data-variant to default', () => {
    render(<MapView styleUrl="https://example.com/style.json" />);
    expect(screen.getByRole('application')).toHaveAttribute(
      'data-variant',
      'default',
    );
  });

  it('sets data-variant to provided value', () => {
    render(
      <MapView styleUrl="https://example.com/style.json" variant="satellite" />,
    );
    expect(screen.getByRole('application')).toHaveAttribute(
      'data-variant',
      'satellite',
    );
  });

  it('renders children', () => {
    render(
      <MapView styleUrl="https://example.com/style.json">
        <span>overlay</span>
      </MapView>,
    );
    expect(screen.getByText('overlay')).toBeInTheDocument();
  });

  it('contains a map-view-canvas div', () => {
    render(<MapView styleUrl="https://example.com/style.json" />);
    const app = screen.getByRole('application');
    const canvas = app.querySelector('.map-view-canvas');
    expect(canvas).toBeInTheDocument();
  });
});
