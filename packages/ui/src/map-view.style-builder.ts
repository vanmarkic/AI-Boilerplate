import type { MapStyleColors } from './map-view.types';

const TOKEN_MAP: Record<keyof MapStyleColors, string> = {
  background: '--color-map-background',
  land: '--color-map-land',
  water: '--color-map-water',
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

function readToken(
  rootStyle: CSSStyleDeclaration,
  key: keyof MapStyleColors,
): string {
  const value = rootStyle.getPropertyValue(TOKEN_MAP[key]).trim();
  return value || FALLBACK_COLORS[key];
}

export function resolveColors(
  overrides: Partial<MapStyleColors>,
  doc?: Document,
): MapStyleColors {
  const rootStyle = doc
    ? getComputedStyle(doc.documentElement)
    : undefined;

  const base: MapStyleColors = rootStyle
    ? {
        background: readToken(rootStyle, 'background'),
        land: readToken(rootStyle, 'land'),
        water: readToken(rootStyle, 'water'),
        roads: readToken(rootStyle, 'roads'),
        buildings: readToken(rootStyle, 'buildings'),
        labels: readToken(rootStyle, 'labels'),
      }
    : { ...FALLBACK_COLORS };

  return { ...base, ...overrides };
}

export function buildBaseStyle(
  styleUrl: string,
  _colors: Partial<MapStyleColors>,
): string {
  return styleUrl;
}
