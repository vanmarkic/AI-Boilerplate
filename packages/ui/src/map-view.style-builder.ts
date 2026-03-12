import type { MapStyleColors } from './map-view.types';

const DEFAULT_COLORS: MapStyleColors = {
  background: 'oklch(13% 0.008 250)',
  land: 'oklch(15% 0.008 250)',
  water: 'oklch(18% 0.04 245)',
  roads: 'oklch(25% 0.008 250)',
  buildings: 'oklch(22% 0.008 250)',
  labels: 'oklch(55% 0.005 250)',
};

export function resolveColors(
  overrides: Partial<MapStyleColors>,
): MapStyleColors {
  return { ...DEFAULT_COLORS, ...overrides };
}

export function buildBaseStyle(
  styleUrl: string,
  _colors: Partial<MapStyleColors>,
): string {
  return styleUrl;
}
