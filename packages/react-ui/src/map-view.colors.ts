import type { Map as MlMap } from 'maplibre-gl';
import type { MapStyleColors } from './map-view.types';
import { ensureHexColors } from './map-view.style-builder';

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

export function resolveColors(overrides: Partial<MapStyleColors>, doc?: Document): MapStyleColors {
  const rootStyle = doc ? getComputedStyle(doc.documentElement) : undefined;

  const base: MapStyleColors = rootStyle
    ? {
        background:
          rootStyle.getPropertyValue(TOKEN_MAP.background).trim() || FALLBACK_COLORS.background,
        land: rootStyle.getPropertyValue(TOKEN_MAP.land).trim() || FALLBACK_COLORS.land,
        water: rootStyle.getPropertyValue(TOKEN_MAP.water).trim() || FALLBACK_COLORS.water,
        roads: rootStyle.getPropertyValue(TOKEN_MAP.roads).trim() || FALLBACK_COLORS.roads,
        buildings:
          rootStyle.getPropertyValue(TOKEN_MAP.buildings).trim() || FALLBACK_COLORS.buildings,
        labels: rootStyle.getPropertyValue(TOKEN_MAP.labels).trim() || FALLBACK_COLORS.labels,
      }
    : { ...FALLBACK_COLORS };

  const merged = { ...base, ...overrides };
  return toMapLibreColors(merged, doc);
}

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
