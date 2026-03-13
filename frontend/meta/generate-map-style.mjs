#!/usr/bin/env node
/**
 * Reads design-system tokens.css and generates a Protomaps-compatible
 * MapLibre style.json with colors baked in from CSS custom properties.
 *
 * Usage:  node meta/generate-map-style.mjs [--tile-url <url>]
 * Output: public/assets/protomaps/style.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TOKENS_PATH = resolve(ROOT, '../packages/design-system/tokens.css');
const OUT_PATH = resolve(ROOT, 'public/assets/protomaps/style.json');

const { values: flags } = parseArgs({
  options: {
    'tile-url': { type: 'string', default: 'pmtiles://assets/protomaps/tiles/region.pmtiles' },
    'glyphs':   { type: 'string', default: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf' },
    'sprite':   { type: 'string', default: 'https://protomaps.github.io/basemaps-assets/sprites/v4/dark' },
  },
});

/* ── Parse tokens.css ─────────────────────────────────── */

const TOKEN_MAP = {
  background: '--color-background',
  water:      '--color-background',
  land:       '--color-card',
  roads:      '--color-border',
  buildings:  '--color-muted',
  labels:     '--color-muted-foreground',
};

function parseTokens(css) {
  const colors = {};
  for (const [key, prop] of Object.entries(TOKEN_MAP)) {
    const re = new RegExp(`${prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*([^;]+);`);
    const match = css.match(re);
    if (!match) throw new Error(`Token ${prop} not found in tokens.css`);
    colors[key] = match[1].trim();
  }
  return colors;
}

/* ── Build style spec ─────────────────────────────────── */

function buildStyle(c, tileUrl, glyphs, sprite) {
  return {
    version: 8,
    sources: { protomaps: { type: 'vector', url: tileUrl } },
    glyphs,
    sprite,
    layers: [
      { id: 'background', type: 'background',
        paint: { 'background-color': c.background } },
      { id: 'earth', type: 'fill',
        source: 'protomaps', 'source-layer': 'earth',
        paint: { 'fill-color': c.land } },
      { id: 'water', type: 'fill',
        source: 'protomaps', 'source-layer': 'water',
        paint: { 'fill-color': c.water } },
      { id: 'landuse_park', type: 'fill',
        source: 'protomaps', 'source-layer': 'landuse',
        filter: ['in', 'pmap:kind', 'park', 'nature_reserve', 'garden'],
        paint: { 'fill-color': c.land, 'fill-opacity': 0.7 } },
      { id: 'roads_minor', type: 'line',
        source: 'protomaps', 'source-layer': 'roads',
        filter: ['in', 'pmap:kind', 'minor_road', 'other'],
        minzoom: 13,
        paint: { 'line-color': c.roads, 'line-width': 0.5 } },
      { id: 'roads_major', type: 'line',
        source: 'protomaps', 'source-layer': 'roads',
        filter: ['in', 'pmap:kind', 'major_road'],
        minzoom: 8,
        paint: { 'line-color': c.roads,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 2] } },
      { id: 'roads_highway', type: 'line',
        source: 'protomaps', 'source-layer': 'roads',
        filter: ['in', 'pmap:kind', 'highway', 'motorway'],
        minzoom: 6,
        paint: { 'line-color': c.roads,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 14, 3] } },
      { id: 'buildings', type: 'fill',
        source: 'protomaps', 'source-layer': 'buildings',
        minzoom: 13,
        paint: { 'fill-color': c.buildings, 'fill-opacity': 0.6 } },
      { id: 'boundaries', type: 'line',
        source: 'protomaps', 'source-layer': 'boundaries',
        paint: { 'line-color': c.roads, 'line-width': 0.5,
          'line-dasharray': [3, 2] } },
      { id: 'places_city', type: 'symbol',
        source: 'protomaps', 'source-layer': 'places',
        filter: ['==', 'pmap:kind', 'city'],
        minzoom: 5,
        layout: { 'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 12, 16] },
        paint: { 'text-color': c.labels,
          'text-halo-color': c.background, 'text-halo-width': 1 } },
      { id: 'places_town', type: 'symbol',
        source: 'protomaps', 'source-layer': 'places',
        filter: ['in', 'pmap:kind', 'town', 'village'],
        minzoom: 8,
        layout: { 'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'], 'text-size': 12 },
        paint: { 'text-color': c.labels,
          'text-halo-color': c.background, 'text-halo-width': 1 } },
    ],
  };
}

/* ── Main ─────────────────────────────────────────────── */

const css = readFileSync(TOKENS_PATH, 'utf-8');
const colors = parseTokens(css);
const style = buildStyle(colors, flags['tile-url'], flags['glyphs'], flags['sprite']);

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(style, null, 2) + '\n');

console.log(`✓ Generated ${OUT_PATH}`);
console.log(`  tokens: ${Object.entries(colors).map(([k, v]) => `${k}=${v}`).join(', ')}`);
