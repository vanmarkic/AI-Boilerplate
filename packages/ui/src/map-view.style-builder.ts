import type { Map as MlMap, StyleSpecification } from 'maplibre-gl';
import type { MapStyleColors } from './map-view.types';

/* ── OKLCH → hex (pure math, no DOM) ─────────────────── */

/** Convert an oklch() CSS string to a #rrggbb hex string for MapLibre. */
export function oklchToHex(color: string): string {
  const m = color.match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)\s*\)/);
  if (!m) return color;
  const L = parseFloat(m[1]) <= 1 ? parseFloat(m[1]) : parseFloat(m[1]) / 100;
  const C = parseFloat(m[2]);
  const H = parseFloat(m[3]) * (Math.PI / 180);

  const a_ = C * Math.cos(H);
  const b_ = C * Math.sin(H);

  const l_ = L + 0.3963377774 * a_ + 0.2158037573 * b_;
  const m_ = L - 0.1055613458 * a_ - 0.0638541728 * b_;
  const s_ = L - 0.0894841775 * a_ - 1.2914855480 * b_;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  const r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const b = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  const toSrgb = (x: number) => {
    const c = Math.max(0, Math.min(1, x));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };
  const toHex = (x: number) =>
    Math.round(Math.max(0, Math.min(255, toSrgb(x) * 255)))
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function ensureHexColors(colors: MapStyleColors): MapStyleColors {
  return {
    background: oklchToHex(colors.background),
    land: oklchToHex(colors.land),
    water: oklchToHex(colors.water),
    roads: oklchToHex(colors.roads),
    buildings: oklchToHex(colors.buildings),
    labels: oklchToHex(colors.labels),
  };
}

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

  const hex = ensureHexColors(colors);

  return {
    version: 8,
    sources: { protomaps: { type: 'vector', url } },
    glyphs,
    sprite,
    layers: buildLayers(hex),
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

/**
 * Convert any CSS color string (including oklch) to an rgb() string
 * that MapLibre GL JS can parse. MapLibre only supports hex, rgb(a),
 * hsl(a), and named colors — not oklch.
 */
function toMapLibreColor(cssColor: string, doc: Document): string {
  if (!cssColor.includes('oklch')) return cssColor;
  const el = doc.createElement('div');
  el.style.color = cssColor;
  doc.body.appendChild(el);
  const rgb = getComputedStyle(el).color;
  el.remove();
  return rgb || cssColor;
}

function toMapLibreColors(colors: MapStyleColors, doc?: Document): MapStyleColors {
  if (!doc) return ensureHexColors(colors);
  return {
    background: toMapLibreColor(colors.background, doc),
    land: toMapLibreColor(colors.land, doc),
    water: toMapLibreColor(colors.water, doc),
    roads: toMapLibreColor(colors.roads, doc),
    buildings: toMapLibreColor(colors.buildings, doc),
    labels: toMapLibreColor(colors.labels, doc),
  };
}

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

  const merged = { ...base, ...overrides };
  return toMapLibreColors(merged, doc);
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
