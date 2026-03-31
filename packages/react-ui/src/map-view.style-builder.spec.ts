import { oklchToHex, buildProtomapsStyle } from './map-view.style-builder';

describe('oklchToHex', () => {
  it('converts oklch value to hex', () => {
    // oklch(0% 0 0) should be black
    const result = oklchToHex('oklch(0% 0 0)');
    expect(result).toBe('#000000');
  });

  it('converts oklch(100% 0 0) to white', () => {
    const result = oklchToHex('oklch(100% 0 0)');
    expect(result).toBe('#ffffff');
  });

  it('passes through non-oklch values unchanged', () => {
    expect(oklchToHex('#ff0000')).toBe('#ff0000');
    expect(oklchToHex('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)');
    expect(oklchToHex('blue')).toBe('blue');
  });

  it('handles oklch with decimal lightness <= 1', () => {
    const result = oklchToHex('oklch(0.5 0 0)');
    // 50% lightness, no chroma — a mid-grey
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('returns a valid 6-digit hex string for non-trivial color', () => {
    const result = oklchToHex('oklch(70% 0.15 200)');
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('buildProtomapsStyle', () => {
  const colors = {
    background: '#1a1a2e',
    land: '#16213e',
    water: '#0f3460',
    roads: '#533483',
    buildings: '#e94560',
    labels: '#ffffff',
  };

  it('returns an object with version 8', () => {
    const style = buildProtomapsStyle(colors, {
      tileUrl: 'https://example.com/tiles.pmtiles',
    });
    expect(style.version).toBe(8);
  });

  it('includes protomaps source with pmtiles:// prefix', () => {
    const style = buildProtomapsStyle(colors, {
      tileUrl: 'https://example.com/tiles.pmtiles',
    });
    expect(style.sources).toEqual({
      protomaps: {
        type: 'vector',
        url: 'pmtiles://https://example.com/tiles.pmtiles',
      },
    });
  });

  it('does not double-prefix when tileUrl already has pmtiles://', () => {
    const style = buildProtomapsStyle(colors, {
      tileUrl: 'pmtiles://https://example.com/tiles.pmtiles',
    });
    const src = style.sources?.['protomaps'] as { url: string };
    expect(src.url).toBe('pmtiles://https://example.com/tiles.pmtiles');
  });

  it('uses default glyphs and sprite CDN when not provided', () => {
    const style = buildProtomapsStyle(colors, {
      tileUrl: 'https://example.com/tiles.pmtiles',
    });
    expect(style.glyphs).toContain('protomaps.github.io');
    expect(style.sprite).toContain('protomaps.github.io');
  });

  it('accepts custom glyphs and sprite', () => {
    const style = buildProtomapsStyle(colors, {
      tileUrl: 'https://example.com/tiles.pmtiles',
      glyphs: 'https://custom.com/fonts/{fontstack}/{range}.pbf',
      sprite: 'https://custom.com/sprites',
    });
    expect(style.glyphs).toBe(
      'https://custom.com/fonts/{fontstack}/{range}.pbf',
    );
    expect(style.sprite).toBe('https://custom.com/sprites');
  });

  it('returns layers array with background as first layer', () => {
    const style = buildProtomapsStyle(colors, {
      tileUrl: 'https://example.com/tiles.pmtiles',
    });
    expect(Array.isArray(style.layers)).toBe(true);
    expect(style.layers.length).toBeGreaterThan(0);
    const first = style.layers[0] as { id: string; type: string };
    expect(first.id).toBe('background');
    expect(first.type).toBe('background');
  });

  it('uses the provided colors in layers', () => {
    const style = buildProtomapsStyle(colors, {
      tileUrl: 'https://example.com/tiles.pmtiles',
    });
    const bg = style.layers[0] as { paint: Record<string, string> };
    expect(bg.paint['background-color']).toBe('#1a1a2e');
  });
});
