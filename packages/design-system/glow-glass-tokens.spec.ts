import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = import.meta.dirname;
const read = (name: string) => readFileSync(resolve(DIR, name), 'utf-8');

describe('glow + glass token system', () => {
  const tokens = read('tokens.css');
  const utilities = read('utilities.css');
  const layout = read('components-layout.css');

  // ── tokens.css — root defaults ─────────────────────────

  it('declares --glow-strength: 0 on :root', () => {
    expect(tokens).toMatch(/--glow-strength:\s*0/);
  });

  it('declares --glass-strength: 0 on :root', () => {
    expect(tokens).toMatch(/--glass-strength:\s*0/);
  });

  it('declares --glow-color on :root', () => {
    expect(tokens).toMatch(/:root\s*\{[\s\S]*--glow-color:/);
  });

  for (const token of ['--glow-sm', '--glow-primary', '--glow-lg', '--glow-xl']) {
    it(`declares ${token} on :root`, () => {
      expect(tokens).toContain(token);
    });
  }

  for (const token of ['--glass-bg', '--glass-border', '--glass-blur', '--glass-shadow']) {
    it(`declares ${token} on :root`, () => {
      expect(tokens).toContain(token);
    });
  }

  // ── tokens.css — data-effects toggle ───────────────────

  it('enables effects via data-effects="glow-glass"', () => {
    const block = tokens.match(/\[data-effects="glow-glass"\]\s*\{([^}]+)\}/);
    expect(block).not.toBeNull();
    expect(block![1]).toMatch(/--glow-strength:\s*1/);
    expect(block![1]).toMatch(/--glass-strength:\s*1/);
  });

  it('disables effects via data-effects="none"', () => {
    const block = tokens.match(/\[data-effects="none"\]\s*\{([^}]+)\}/);
    expect(block).not.toBeNull();
    expect(block![1]).toMatch(/--glow-strength:\s*0/);
    expect(block![1]).toMatch(/--glass-strength:\s*0/);
  });

  // ── tokens.css — accessibility ─────────────────────────

  it('disables glow+glass in prefers-reduced-motion', () => {
    const motionBlock = tokens.match(/prefers-reduced-motion:\s*reduce[\s\S]*?\{([\s\S]*?)\}\s*\}/);
    expect(motionBlock).not.toBeNull();
    expect(motionBlock![1]).toMatch(/--glow-strength:\s*0/);
    expect(motionBlock![1]).toMatch(/--glass-strength:\s*0/);
  });

  it('disables glow+glass in prefers-contrast: more', () => {
    const contrastBlock = tokens.match(/prefers-contrast:\s*more[\s\S]*?\{([\s\S]*?)\}\s*\}/);
    expect(contrastBlock).not.toBeNull();
    expect(contrastBlock![1]).toMatch(/--glow-strength:\s*0/);
    expect(contrastBlock![1]).toMatch(/--glass-strength:\s*0/);
  });

  // ── utilities.css — glow + glass classes ───────────────

  for (const cls of ['.glow-sm', '.glow-lg', '.glow-xl', '.glow ']) {
    it(`has utility class ${cls.trim()}`, () => {
      expect(utilities).toContain(cls.trim());
    });
  }

  it('has .glass utility with backdrop-filter', () => {
    expect(utilities).toMatch(/\.glass\s*\{[\s\S]*?backdrop-filter/);
  });

  it('.glass references --glass-bg', () => {
    expect(utilities).toMatch(/\.glass\s*\{[\s\S]*?var\(--glass-bg\)/);
  });

  it('.glass references --glass-shadow', () => {
    expect(utilities).toMatch(/\.glass\s*\{[\s\S]*?var\(--glass-shadow\)/);
  });

  // ── components-layout.css — landing-glow wired ────────

  it('.landing-glow uses --glow-strength for opacity', () => {
    expect(layout).toMatch(/\.landing-glow[\s\S]*?opacity:\s*calc\([^)]*var\(--glow-strength\)/);
  });
});
