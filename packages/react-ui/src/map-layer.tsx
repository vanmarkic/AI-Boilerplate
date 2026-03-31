import { useEffect, useRef } from 'react';
import type { AddLayerObject, MapLayerMouseEvent } from 'maplibre-gl';
import type { GeoJSON } from 'geojson';
import type {
  MapFeatureEvent,
  MapLayerType,
  MapLayout,
  MapPaint,
} from './map-view.types';
import { useMapView } from './map-view.context';

export interface MapLayerProps {
  id: string;
  type: MapLayerType;
  source: GeoJSON;
  paint?: MapPaint;
  layout?: MapLayout;
  minZoom?: number;
  maxZoom?: number;
  cursor?: string;
  onFeatureClick?: (event: MapFeatureEvent) => void;
  onFeatureHover?: (event: MapFeatureEvent) => void;
}

export function MapLayer({
  id,
  type,
  source,
  paint = {},
  layout = {},
  minZoom,
  maxZoom,
  cursor = 'pointer',
  onFeatureClick,
  onFeatureHover,
}: MapLayerProps) {
  const { map } = useMapView();
  const registeredRef = useRef(false);
  const onClickRef = useRef(onFeatureClick);
  const onHoverRef = useRef(onFeatureHover);
  onClickRef.current = onFeatureClick;
  onHoverRef.current = onFeatureHover;

  useEffect(() => {
    if (!map || registeredRef.current) return;
    registeredRef.current = true;

    map.addSource(id, { type: 'geojson', data: source });
    const layerDef = {
      id,
      type,
      source: id,
      paint,
      layout,
      ...(minZoom != null ? { minzoom: minZoom } : {}),
      ...(maxZoom != null ? { maxzoom: maxZoom } : {}),
    } as unknown as AddLayerObject;
    map.addLayer(layerDef);

    const clickHandler = (e: MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (!feat) return;
      onClickRef.current?.({
        lngLat: { lng: e.lngLat.lng, lat: e.lngLat.lat },
        feature: {
          properties: feat.properties ?? {},
          geometry: feat.geometry,
        },
      });
    };

    const hoverHandler = (e: MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (!feat) return;
      onHoverRef.current?.({
        lngLat: { lng: e.lngLat.lng, lat: e.lngLat.lat },
        feature: {
          properties: feat.properties ?? {},
          geometry: feat.geometry,
        },
      });
    };

    const canvas = map.getCanvas();
    const enterHandler = () => {
      canvas.style.cursor = cursor;
    };
    const leaveHandler = () => {
      canvas.style.cursor = '';
    };

    map.on('click', id, clickHandler);
    map.on('mousemove', id, hoverHandler);
    map.on('mouseenter', id, enterHandler);
    map.on('mouseleave', id, leaveHandler);

    return () => {
      map.off('click', id, clickHandler);
      map.off('mousemove', id, hoverHandler);
      map.off('mouseenter', id, enterHandler);
      map.off('mouseleave', id, leaveHandler);
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
      registeredRef.current = false;
    };
    // Register once when map becomes available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    if (!map || !registeredRef.current) return;
    const src = map.getSource(id);
    if (src && 'setData' in src) {
      (src as { setData: (d: GeoJSON) => void }).setData(source);
    }
  }, [map, id, source]);

  useEffect(() => {
    if (!map || !registeredRef.current) return;
    for (const [key, value] of Object.entries(paint)) {
      map.setPaintProperty(id, key, value);
    }
  }, [map, id, paint]);

  useEffect(() => {
    if (!map || !registeredRef.current) return;
    for (const [key, value] of Object.entries(layout)) {
      map.setLayoutProperty(id, key, value);
    }
  }, [map, id, layout]);

  return null;
}
