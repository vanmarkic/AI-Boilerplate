import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Map as MlMap, StyleSpecification } from 'maplibre-gl';
import type {
  MapCenter,
  MapMoveEvent,
  MapStyleColors,
  MapVariant,
} from './map-view.types';
import { createMap } from './map-view.init';
import { MapViewContext } from './map-view.context';

export interface MapViewProps {
  center?: MapCenter;
  zoom?: number;
  styleUrl: string | StyleSpecification;
  variant?: MapVariant;
  ariaLabel?: string;
  colors?: Partial<MapStyleColors>;
  interactive?: boolean;
  onMapMove?: (event: MapMoveEvent) => void;
  onMapLoad?: () => void;
  children?: ReactNode;
}

export function MapView({
  center = { lng: 0, lat: 0 },
  zoom = 2,
  styleUrl,
  variant = 'default',
  ariaLabel = 'Interactive map',
  colors = {},
  interactive = true,
  onMapMove,
  onMapLoad,
  children,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MlMap | null>(null);
  const onMoveRef = useRef(onMapMove);
  const onLoadRef = useRef(onMapLoad);
  onMoveRef.current = onMapMove;
  onLoadRef.current = onMapLoad;

  const handleMove = useCallback((event: MapMoveEvent) => {
    onMoveRef.current?.(event);
  }, []);

  const handleLoad = useCallback((m: MlMap) => {
    setMap(m);
    onLoadRef.current?.();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const m = createMap({
      container: containerRef.current,
      style: styleUrl,
      center,
      zoom,
      interactive,
      colors,
      onMove: handleMove,
      onLoad: handleLoad,
    });
    return () => {
      m.remove();
    };
    // Only create the map once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map) return;
    map.easeTo({ center: [center.lng, center.lat], duration: 300 });
  }, [map, center.lng, center.lat]);

  useEffect(() => {
    if (!map) return;
    map.easeTo({ zoom, duration: 300 });
  }, [map, zoom]);

  const ctx = useMemo(() => ({ map }), [map]);

  return (
    <MapViewContext.Provider value={ctx}>
      <div
        className="map-view"
        data-variant={variant}
        aria-label={ariaLabel}
        role="application"
      >
        <div className="map-view-canvas" ref={containerRef} />
        {children}
      </div>
    </MapViewContext.Provider>
  );
}
