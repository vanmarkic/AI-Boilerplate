import { resolveColors } from './map-view.colors';
import { oklchToHex } from './map-view.style-builder';

function makeFakeDoc() {
  const fakeEl = {
    style: { color: '' },
    remove: vi.fn(),
  };
  return {
    el: fakeEl,
    doc: {
      documentElement: {} as HTMLElement,
      createElement: vi.fn(() => fakeEl),
      body: { appendChild: vi.fn() },
    } as unknown as Document,
  };
}

function makeStyleMock(
  tokens: Record<string, string>,
  colorResult: string,
) {
  return {
    color: colorResult,
    getPropertyValue: (prop: string) => tokens[prop] ?? '',
  } as unknown as CSSStyleDeclaration;
}

describe('map-view style-builder', () => {
  describe('resolveColors', () => {
    it('should return hex-converted fallback colors when no document is provided', () => {
      const colors = resolveColors({});
      expect(colors.background).toBe(oklchToHex('oklch(13% 0.008 250)'));
      expect(colors.water).toBe(oklchToHex('oklch(18% 0.04 245)'));
      expect(colors.labels).toBe(oklchToHex('oklch(55% 0.005 250)'));
    });

    it('should apply overrides and convert to hex', () => {
      const colors = resolveColors({ water: 'oklch(20% 0.06 250)' });
      expect(colors.water).toBe(oklchToHex('oklch(20% 0.06 250)'));
      expect(colors.land).toBe(oklchToHex('oklch(15% 0.008 250)'));
    });

    it('should pass through non-oklch overrides unchanged', () => {
      const colors = resolveColors({ water: 'red' });
      expect(colors.water).toBe('red');
    });

    it('should read tokens from document when provided', () => {
      const { doc } = makeFakeDoc();
      const fakeStyle = makeStyleMock(
        {
          '--color-map-background': 'oklch(10% 0.01 240)',
          '--color-map-land': 'oklch(12% 0.01 240)',
          '--color-map-water': 'oklch(15% 0.05 240)',
          '--color-map-roads': 'oklch(20% 0.01 240)',
          '--color-map-buildings': 'oklch(18% 0.01 240)',
          '--color-map-labels': 'oklch(50% 0.005 240)',
        },
        'rgb(10, 20, 30)',
      );

      vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue(fakeStyle);

      const colors = resolveColors({}, doc);
      expect(colors.background).toBe('rgb(10, 20, 30)');
      expect(colors.water).toBe('rgb(10, 20, 30)');

      vi.restoreAllMocks();
    });

    it('should fall back for missing tokens in document', () => {
      const { doc } = makeFakeDoc();
      const fakeStyle = makeStyleMock({}, 'rgb(0, 0, 0)');

      vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue(fakeStyle);

      const colors = resolveColors({}, doc);
      // Fallback oklch values go through toMapLibreColor → getComputedStyle(el).color
      expect(colors.background).toBe('rgb(0, 0, 0)');

      vi.restoreAllMocks();
    });

    it('should let overrides win over document tokens', () => {
      const { doc } = makeFakeDoc();
      const fakeStyle = makeStyleMock(
        { '--color-map-water': 'oklch(15% 0.05 240)' },
        'rgb(255, 0, 0)',
      );

      vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue(fakeStyle);

      const colors = resolveColors({ water: 'red' }, doc);
      // 'red' doesn't contain 'oklch' so toMapLibreColor returns it as-is
      expect(colors.water).toBe('red');

      vi.restoreAllMocks();
    });
  });
});
