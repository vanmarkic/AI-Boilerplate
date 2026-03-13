import type { Map as MlMap, StyleSpecification } from 'maplibre-gl';
import type { MapStyleColors } from './map-view.types';

/* ── Protomaps style builder (pure — no DOM) ─────────── */

const GLYPHS_CDN =
  'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';
const SPRITE_CDN =
  'https://protomaps.github.io/basemaps-assets/sprites/v4/dark';

export interface ProtomapsStyleOptions {
  /** PMTiles URL (with or without pmtiles:// prefix). */
  tileUrl: string;
  glyphs?: string;
  sprite?: string;
}

/** Build a full MapLibre StyleSpecification from resolved colors. */
export function buildProtomapsStyle(
  colors: MapStyleColors,
  options: ProtomapsStyleOptions,
): StyleSpecification {
  const {
    tileUrl,
    glyphs = GLYPHS_CDN,
    sprite = SPRITE_CDN,
  } = options;

  const url = tileUrl.startsWith('pmtiles://') ? tileUrl : `pmtiles://${tileUrl}`;

  return {
    version: 8,
    sources: { protomaps: { type: 'vector', url } },
    glyphs,
    sprite,
    layers: buildLayers(colors),
  } as StyleSpecification;
}

function buildLayers(c: MapStyleColors): StyleSpecification['layers'] {
  return [
    {
      id: 'background', type: 'background',
      paint: { 'background-color': c.background },
    },
    {
      id: 'earth', type: 'fill',
      source: 'protomaps', 'source-layer': 'earth',
      paint: { 'fill-color': c.land },
    },
    {
      id: 'water', type: 'fill',
      source: 'protomaps', 'source-layer': 'water',
      paint: { 'fill-color': c.water },
    },
    {
      id: 'landuse_park', type: 'fill',
      source: 'protomaps', 'source-layer': 'landuse',
      filter: ['in', 'pmap:kind', 'park', 'nature_reserve', 'garden'],
      paint: { 'fill-color': c.land, 'fill-opacity': 0.7 },
    },
    {
      id: 'roads_minor', type: 'line',
      source: 'protomaps', 'source-layer': 'roads',
      filter: ['in', 'pmap:kind', 'minor_road', 'other'],
      minzoom: 13,
      paint: { 'line-color': c.roads, 'line-width': 0.5 },
    },
    {
      id: 'roads_major', type: 'line',
      source: 'protomaps', 'source-layer': 'roads',
      filter: ['in', 'pmap:kind', 'major_road'],
      minzoom: 8,
      paint: {
        'line-color': c.roads,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 2],
      },
    },
    {
      id: 'roads_highway', type: 'line',
      source: 'protomaps', 'source-layer': 'roads',
      filter: ['in', 'pmap:kind', 'highway', 'motorway'],
      minzoom: 6,
      paint: {
        'line-color': c.roads,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 14, 3],
      },
    },
    {
      id: 'buildings', type: 'fill',
      source: 'protomaps', 'source-layer': 'buildings',
      minzoom: 13,
      paint: { 'fill-color': c.buildings, 'fill-opacity': 0.6 },
    },
    {
      id: 'boundaries', type: 'line',
      source: 'protomaps', 'source-layer': 'boundaries',
      paint: {
        'line-color': c.roads, 'line-width': 0.5,
        'line-dasharray': [3, 2],
      },
    },
    {
      id: 'places_city', type: 'symbol',
      source: 'protomaps', 'source-layer': 'places',
      filter: ['==', 'pmap:kind', 'city'],
      minzoom: 5,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 12, 16],
      },
      paint: {
        'text-color': c.labels,
        'text-halo-color': c.background,
        'text-halo-width': 1,
      },
    },
    {
      id: 'places_town', type: 'symbol',
      source: 'protomaps', 'source-layer': 'places',
      filter: ['in', 'pmap:kind', 'town', 'village'],
      minzoom: 8,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 12,
      },
      paint: {
        'text-color': c.labels,
        'text-halo-color': c.background,
        'text-halo-width': 1,
      },
    },
  ] as StyleSpecification['layers'];
}

/* ── Demotiles fallback (post-load color patching) ──── */

/** Token-to-CSS-prop mapping using dedicated map tokens from tokens.css. */
const TOKEN_MAP: Record<keyof MapStyleColors, string> = {
  background: '--color-map-background',
  water: '--color-map-water',
  land: '--color-map-land',
  roads: '--color-map-roads',
  buildings: '--color-map-buildings',
  labels: '--color-map-labels',
};

const FALLBACK_COLORS: MapStyleColors = {
  background: 'oklch(13% 0.008 250)',
  land: 'oklch(15% 0.008 250)',
  water: 'oklch(18% 0.04 245)',
  roads: 'oklch(25% 0.008 250)',
  buildings: 'oklch(22% 0.008 250)',
  labels: 'oklch(55% 0.005 250)',
};

/** Read design tokens from a Document for runtime color overrides. */
export function resolveColors(
  overrides: Partial<MapStyleColors>,
  doc?: Document,
): MapStyleColors {
  const rootStyle = doc
    ? getComputedStyle(doc.documentElement)
    : undefined;

  const base: MapStyleColors = rootStyle
    ? {
        background: rootStyle.getPropertyValue(TOKEN_MAP.background).trim() || FALLBACK_COLORS.background,
        land: rootStyle.getPropertyValue(TOKEN_MAP.land).trim() || FALLBACK_COLORS.land,
        water: rootStyle.getPropertyValue(TOKEN_MAP.water).trim() || FALLBACK_COLORS.water,
        roads: rootStyle.getPropertyValue(TOKEN_MAP.roads).trim() || FALLBACK_COLORS.roads,
        buildings: rootStyle.getPropertyValue(TOKEN_MAP.buildings).trim() || FALLBACK_COLORS.buildings,
        labels: rootStyle.getPropertyValue(TOKEN_MAP.labels).trim() || FALLBACK_COLORS.labels,
      }
    : { ...FALLBACK_COLORS };

  return { ...base, ...overrides };
}

/** Apply colors to an already-loaded map (for demotiles or similar). */
export function applyColorsToMap(map: MlMap, colors: MapStyleColors): void {
  const layerMapping: [string, string, string][] = [
    ['background', 'background-color', colors.water],
    ['countries-fill', 'fill-color', colors.land],
    ['crimea-fill', 'fill-color', colors.land],
    ['coastline', 'line-color', colors.roads],
    ['countries-boundary', 'line-color', colors.roads],
    ['geolines', 'line-color', colors.roads],
    ['countries-label', 'text-color', colors.labels],
    ['geolines-label', 'text-color', colors.labels],
  ];

  for (const [layerId, prop, value] of layerMapping) {
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, prop, value);
    }
  }
}
