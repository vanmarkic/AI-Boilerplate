# Protomaps Self-Hosted Assets

This directory holds self-hosted map assets for production use.
Storybook stories use remote URLs for development convenience.

## Directory Structure

```
protomaps/
├── tiles/       # PMTiles vector tile archives
├── fonts/       # Glyph PBF ranges (e.g. Noto Sans Regular/0-255.pbf)
└── sprites/     # Sprite sheets (dark.json + dark.png, light.json + light.png)
```

## Download Tiles

Use the `pmtiles` CLI to create a regional extract from a planet file,
or download a pre-built extract:

```bash
# Install pmtiles CLI
npm install -g pmtiles

# Option A: download a test extract (~6 MB, Florence)
curl -Lo frontend/public/assets/protomaps/tiles/firenze.pmtiles \
  "https://pmtiles.io/protomaps(vector)ODbL_firenze.pmtiles"

# Option B: extract a region from a planet file
pmtiles extract planet.pmtiles region.pmtiles \
  --bbox=2.2,48.8,2.5,48.9
```

## Download Fonts

```bash
# Noto Sans Regular (required by the style builder)
mkdir -p frontend/public/assets/protomaps/fonts/Noto\ Sans\ Regular
for range in 0-255 256-511 512-767 768-1023; do
  curl -Lo "frontend/public/assets/protomaps/fonts/Noto Sans Regular/${range}.pbf" \
    "https://protomaps.github.io/basemaps-assets/fonts/Noto%20Sans%20Regular/${range}.pbf"
done
```

## Download Sprites

```bash
mkdir -p frontend/public/assets/protomaps/sprites
for variant in dark light; do
  curl -Lo "frontend/public/assets/protomaps/sprites/${variant}.json" \
    "https://protomaps.github.io/basemaps-assets/sprites/v4/${variant}.json"
  curl -Lo "frontend/public/assets/protomaps/sprites/${variant}.png" \
    "https://protomaps.github.io/basemaps-assets/sprites/v4/${variant}.png"
  curl -Lo "frontend/public/assets/protomaps/sprites/${variant}@2x.json" \
    "https://protomaps.github.io/basemaps-assets/sprites/v4/${variant}@2x.json"
  curl -Lo "frontend/public/assets/protomaps/sprites/${variant}@2x.png" \
    "https://protomaps.github.io/basemaps-assets/sprites/v4/${variant}@2x.png"
done
```

## Using Self-Hosted Assets

```typescript
const style = buildProtomapsStyle(colors, {
  tileUrl: '/assets/protomaps/tiles/region.pmtiles',
  glyphs: '/assets/protomaps/fonts/{fontstack}/{range}.pbf',
  sprite: '/assets/protomaps/sprites/dark',
});
```
