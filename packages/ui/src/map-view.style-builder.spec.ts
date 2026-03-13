import { resolveColors, buildBaseStyle } from './map-view.style-builder';

describe('map-view style-builder', () => {
  describe('resolveColors', () => {
    it('should return fallback colors when no document is provided', () => {
      const colors = resolveColors({});
      expect(colors.background).toBe('oklch(13% 0.008 250)');
      expect(colors.water).toBe('oklch(18% 0.04 245)');
      expect(colors.labels).toBe('oklch(55% 0.005 250)');
    });

    it('should apply overrides on top of fallback colors', () => {
      const colors = resolveColors({ water: 'oklch(20% 0.06 250)' });
      expect(colors.water).toBe('oklch(20% 0.06 250)');
      expect(colors.land).toBe('oklch(15% 0.008 250)');
    });

    it('should read tokens from document when provided', () => {
      const fakeDoc = {
        documentElement: {} as HTMLElement,
      } as Document;

      const fakeStyle = {
        getPropertyValue: (prop: string) => {
          const tokens: Record<string, string> = {
            '--color-map-background': 'oklch(10% 0.01 240)',
            '--color-map-land': 'oklch(12% 0.01 240)',
            '--color-map-water': 'oklch(15% 0.05 240)',
            '--color-map-roads': 'oklch(20% 0.01 240)',
            '--color-map-buildings': 'oklch(18% 0.01 240)',
            '--color-map-labels': 'oklch(50% 0.005 240)',
          };
          return tokens[prop] ?? '';
        },
      } as CSSStyleDeclaration;

      jest.spyOn(globalThis, 'getComputedStyle').mockReturnValue(fakeStyle);

      const colors = resolveColors({}, fakeDoc);
      expect(colors.background).toBe('oklch(10% 0.01 240)');
      expect(colors.water).toBe('oklch(15% 0.05 240)');

      jest.restoreAllMocks();
    });

    it('should fall back for missing tokens in document', () => {
      const fakeDoc = {
        documentElement: {} as HTMLElement,
      } as Document;

      const fakeStyle = {
        getPropertyValue: () => '',
      } as unknown as CSSStyleDeclaration;

      jest.spyOn(globalThis, 'getComputedStyle').mockReturnValue(fakeStyle);

      const colors = resolveColors({}, fakeDoc);
      expect(colors.background).toBe('oklch(13% 0.008 250)');

      jest.restoreAllMocks();
    });

    it('should let overrides win over document tokens', () => {
      const fakeDoc = {
        documentElement: {} as HTMLElement,
      } as Document;

      const fakeStyle = {
        getPropertyValue: (prop: string) =>
          prop === '--color-map-water' ? 'oklch(15% 0.05 240)' : '',
      } as CSSStyleDeclaration;

      jest.spyOn(globalThis, 'getComputedStyle').mockReturnValue(fakeStyle);

      const colors = resolveColors({ water: 'red' }, fakeDoc);
      expect(colors.water).toBe('red');

      jest.restoreAllMocks();
    });
  });

  describe('buildBaseStyle', () => {
    it('should return the style URL as-is', () => {
      const url = 'https://tiles.example.com/style.json';
      expect(buildBaseStyle(url, {})).toBe(url);
    });
  });
});
