import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapPopup } from './map-popup';
import { MapViewContext } from './map-view.context';

vi.mock('maplibre-gl', () => ({
  Map: vi.fn(),
  Marker: vi.fn(),
  Popup: vi.fn(() => ({
    setDOMContent: vi.fn().mockReturnThis(),
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    on: vi.fn(),
    remove: vi.fn(),
  })),
  addProtocol: vi.fn(),
}));

vi.mock('pmtiles', () => ({
  Protocol: vi.fn(() => ({ tile: vi.fn() })),
}));

describe('MapPopup', () => {
  it('renders children inside popup content', () => {
    render(
      <MapViewContext.Provider value={{ map: null }}>
        <MapPopup lngLat={{ lng: 0, lat: 0 }}>
          <p>Hello popup</p>
        </MapPopup>
      </MapViewContext.Provider>,
    );
    expect(screen.getByText('Hello popup')).toBeInTheDocument();
  });

  it('renders a close button by default', () => {
    render(
      <MapViewContext.Provider value={{ map: null }}>
        <MapPopup lngLat={{ lng: 0, lat: 0 }}>content</MapPopup>
      </MapViewContext.Provider>,
    );
    expect(
      screen.getByRole('button', { name: 'Close popup' }),
    ).toBeInTheDocument();
  });

  it('hides the close button when variant is tooltip', () => {
    render(
      <MapViewContext.Provider value={{ map: null }}>
        <MapPopup lngLat={{ lng: 0, lat: 0 }} variant="tooltip">
          tip
        </MapPopup>
      </MapViewContext.Provider>,
    );
    expect(
      screen.queryByRole('button', { name: 'Close popup' }),
    ).not.toBeInTheDocument();
  });

  it('sets data-variant attribute', () => {
    render(
      <MapViewContext.Provider value={{ map: null }}>
        <MapPopup lngLat={{ lng: 0, lat: 0 }} variant="tooltip">
          tip
        </MapPopup>
      </MapViewContext.Provider>,
    );
    const popup = screen.getByText('tip').closest('.map-popup');
    expect(popup).toHaveAttribute('data-variant', 'tooltip');
  });

  it('defaults data-variant to default', () => {
    render(
      <MapViewContext.Provider value={{ map: null }}>
        <MapPopup lngLat={{ lng: 0, lat: 0 }}>info</MapPopup>
      </MapViewContext.Provider>,
    );
    const popup = screen.getByText('info').closest('.map-popup');
    expect(popup).toHaveAttribute('data-variant', 'default');
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <MapViewContext.Provider value={{ map: null }}>
        <MapPopup lngLat={{ lng: 0, lat: 0 }} onClose={onClose}>
          content
        </MapPopup>
      </MapViewContext.Provider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close popup' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('wraps children in map-popup-content div', () => {
    render(
      <MapViewContext.Provider value={{ map: null }}>
        <MapPopup lngLat={{ lng: 0, lat: 0 }}>wrapped</MapPopup>
      </MapViewContext.Provider>,
    );
    const content = screen.getByText('wrapped').closest('.map-popup-content');
    expect(content).toBeInTheDocument();
  });
});
