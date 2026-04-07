import { render } from '@testing-library/react';
import type { Map as MlMap } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { MapLayer } from './map-layer';
import { MapViewContext } from './map-view.context';

const mockMap = {
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  remove: vi.fn(),
  getCenter: vi.fn(() => ({ lng: 0, lat: 0 })),
  getBounds: vi.fn(),
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
} as unknown as MlMap;

vi.mock('maplibre-gl', () => ({
  Map: vi.fn(),
  Marker: vi.fn(),
  Popup: vi.fn(),
  addProtocol: vi.fn(),
}));

vi.mock('pmtiles', () => ({
  Protocol: vi.fn(() => ({ tile: vi.fn() })),
}));

const emptyGeoJson: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

describe('MapLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing (returns null)', () => {
    const { container } = render(
      <MapViewContext.Provider value={{ map: null }}>
        <MapLayer id="test-layer" type="fill" source={emptyGeoJson} />
      </MapViewContext.Provider>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('registers source and layer when map is available', () => {
    render(
      <MapViewContext.Provider value={{ map: mockMap }}>
        <MapLayer
          id="my-layer"
          type="circle"
          source={emptyGeoJson}
          paint={{ 'circle-radius': 5 }}
        />
      </MapViewContext.Provider>,
    );
    expect(mockMap.addSource).toHaveBeenCalledWith('my-layer', {
      type: 'geojson',
      data: emptyGeoJson,
    });
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'my-layer',
        type: 'circle',
        source: 'my-layer',
        paint: { 'circle-radius': 5 },
      }),
    );
  });

  it('registers event listeners on the map', () => {
    render(
      <MapViewContext.Provider value={{ map: mockMap }}>
        <MapLayer id="events-layer" type="fill" source={emptyGeoJson} />
      </MapViewContext.Provider>,
    );
    expect(mockMap.on).toHaveBeenCalledWith(
      'click',
      'events-layer',
      expect.any(Function),
    );
    expect(mockMap.on).toHaveBeenCalledWith(
      'mousemove',
      'events-layer',
      expect.any(Function),
    );
    expect(mockMap.on).toHaveBeenCalledWith(
      'mouseenter',
      'events-layer',
      expect.any(Function),
    );
    expect(mockMap.on).toHaveBeenCalledWith(
      'mouseleave',
      'events-layer',
      expect.any(Function),
    );
  });

  it('does not register when map is null', () => {
    render(
      <MapViewContext.Provider value={{ map: null }}>
        <MapLayer id="no-map" type="fill" source={emptyGeoJson} />
      </MapViewContext.Provider>,
    );
    expect(mockMap.addSource).not.toHaveBeenCalled();
    expect(mockMap.addLayer).not.toHaveBeenCalled();
  });

  it('includes minzoom and maxzoom when provided', () => {
    render(
      <MapViewContext.Provider value={{ map: mockMap }}>
        <MapLayer
          id="zoom-layer"
          type="line"
          source={emptyGeoJson}
          minZoom={5}
          maxZoom={15}
        />
      </MapViewContext.Provider>,
    );
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        minzoom: 5,
        maxzoom: 15,
      }),
    );
  });
});
