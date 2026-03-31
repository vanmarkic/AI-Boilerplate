import { Map as MlMap, type StyleSpecification } from 'maplibre-gl';

import type { MapCenter, MapMoveEvent, MapStyleColors } from './map-view.types';
import { resolveColors, applyColorsToMap } from './map-view.colors';
import { registerPmtilesProtocol } from './map-view.pmtiles';

export interface MapInitOptions {
  container: HTMLDivElement;
  style: string | StyleSpecification;
  center: MapCenter;
  zoom: number;
  interactive: boolean;
  colors: Partial<MapStyleColors>;
  onMove: (event: MapMoveEvent) => void;
  onLoad: (map: MlMap) => void;
}

export function createMap(opts: MapInitOptions): MlMap {
  registerPmtilesProtocol();
  const isUrl = typeof opts.style === 'string';

  const map = new MlMap({
    container: opts.container,
    style: opts.style,
    center: [opts.center.lng, opts.center.lat],
    zoom: opts.zoom,
    interactive: opts.interactive,
    attributionControl: false,
  });

  let destroyed = false;

  map.on('moveend', () => {
    if (destroyed) return;
    const c = map.getCenter();
    const b = map.getBounds();
    opts.onMove({
      center: { lng: c.lng, lat: c.lat },
      zoom: map.getZoom(),
      bounds: {
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      },
    });
  });

  map.on('load', () => {
    if (destroyed) return;
    if (isUrl) {
      const colors = resolveColors(opts.colors);
      applyColorsToMap(map, colors);
    }
    opts.onLoad(map);
  });

  map.once('remove', () => {
    destroyed = true;
  });
  return map;
}
