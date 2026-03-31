import { type ReactNode, useEffect, useRef } from 'react';
import { Popup } from 'maplibre-gl';
import type { MapCenter, MapPopupAnchor, MapPopupVariant } from './map-view.types';
import { useMapView } from './map-view.context';

export interface MapPopupProps {
  lngLat: MapCenter;
  anchor?: MapPopupAnchor;
  variant?: MapPopupVariant;
  offset?: number;
  closeOnMapClick?: boolean;
  onClose?: () => void;
  children?: ReactNode;
}

export function MapPopup({
  lngLat,
  anchor = 'bottom',
  variant = 'default',
  offset = 12,
  closeOnMapClick = true,
  onClose,
  children,
}: MapPopupProps) {
  const { map } = useMapView();
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<Popup | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!map || !containerRef.current || popupRef.current) return;

    const popup = new Popup({
      closeButton: false,
      closeOnClick: closeOnMapClick,
      anchor,
      offset,
      className: 'map-popup-container',
    })
      .setDOMContent(containerRef.current)
      .setLngLat([lngLat.lng, lngLat.lat])
      .addTo(map);

    popup.on('close', () => {
      onCloseRef.current?.();
    });

    popupRef.current = popup;

    return () => {
      popup.remove();
      popupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    popupRef.current?.setLngLat([lngLat.lng, lngLat.lat]);
  }, [lngLat.lng, lngLat.lat]);

  return (
    <div ref={containerRef} className="map-popup" data-variant={variant}>
      <div className="map-popup-content">{children}</div>
      {variant !== 'tooltip' && (
        <button
          className="map-popup-close"
          type="button"
          aria-label="Close popup"
          onClick={() => onClose?.()}
        >
          &times;
        </button>
      )}
    </div>
  );
}
