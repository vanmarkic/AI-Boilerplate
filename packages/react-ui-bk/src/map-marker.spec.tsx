import { render, screen } from '@testing-library/react';
import { MapMarker } from './map-marker';
import { MapViewContext } from './map-view.context';

vi.mock('maplibre-gl', () => ({
  Map: vi.fn(),
  Marker: vi.fn(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    on: vi.fn(),
    remove: vi.fn(),
    getLngLat: vi.fn(() => ({ lng: 1, lat: 2 })),
  })),
  Popup: vi.fn(),
  addProtocol: vi.fn(),
}));

vi.mock('pmtiles', () => ({
  Protocol: vi.fn(() => ({ tile: vi.fn() })),
}));

describe('MapMarker', () => {
  it('renders children inside a .map-marker div', () => {
    render(
      <MapViewContext.Provider value={{ map: null }}>
        <MapMarker lngLat={{ lng: 10, lat: 20 }}>
          <span>Pin</span>
        </MapMarker>
      </MapViewContext.Provider>,
    );
    const marker = screen.getByText('Pin').closest('.map-marker');
    expect(marker).toBeInTheDocument();
    expect(marker).toHaveClass('map-marker');
  });

  it('renders the marker container even without a map', () => {
    render(
      <MapViewContext.Provider value={{ map: null }}>
        <MapMarker lngLat={{ lng: 0, lat: 0 }}>
          <span>icon</span>
        </MapMarker>
      </MapViewContext.Provider>,
    );
    expect(screen.getByText('icon')).toBeInTheDocument();
  });

  it('renders multiple children', () => {
    render(
      <MapViewContext.Provider value={{ map: null }}>
        <MapMarker lngLat={{ lng: 5, lat: 5 }}>
          <span>A</span>
          <span>B</span>
        </MapMarker>
      </MapViewContext.Provider>,
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });
});
