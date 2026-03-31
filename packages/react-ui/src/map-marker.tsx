import { type ReactNode, useEffect, useRef } from 'react';
import { Marker } from 'maplibre-gl';
import type { MapCenter } from './map-view.types';
import { useMapView } from './map-view.context';

type PositionAnchor =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface MapMarkerProps {
  lngLat: MapCenter;
  draggable?: boolean;
  anchor?: PositionAnchor;
  onClick?: () => void;
  onDragEnd?: (position: MapCenter) => void;
  children?: ReactNode;
}

export function MapMarker({
  lngLat,
  draggable = false,
  anchor = 'center',
  onClick,
  onDragEnd,
  children,
}: MapMarkerProps) {
  const { map } = useMapView();
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<Marker | null>(null);
  const onClickRef = useRef(onClick);
  const onDragEndRef = useRef(onDragEnd);
  onClickRef.current = onClick;
  onDragEndRef.current = onDragEnd;

  useEffect(() => {
    if (!map || !containerRef.current || markerRef.current) return;

    const marker = new Marker({
      element: containerRef.current,
      draggable,
      anchor,
    })
      .setLngLat([lngLat.lng, lngLat.lat])
      .addTo(map);

    containerRef.current.addEventListener('click', () => {
      onClickRef.current?.();
    });

    if (draggable) {
      marker.on('dragend', () => {
        const p = marker.getLngLat();
        onDragEndRef.current?.({ lng: p.lng, lat: p.lat });
      });
    }

    markerRef.current = marker;

    return () => {
      marker.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    markerRef.current?.setLngLat([lngLat.lng, lngLat.lat]);
  }, [lngLat.lng, lngLat.lat]);

  return (
    <div ref={containerRef} className="map-marker">
      {children}
    </div>
  );
}
