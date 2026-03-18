import * as THREE from "three";

// ── Signal types ────────────────────────────────────────────

export const enum SignalType {
  Friendly,
  Hostile,
  Neutral,
}

export const SIGNAL_COLORS: Record<SignalType, number> = {
  [SignalType.Friendly]: 0x22d68a, // green
  [SignalType.Hostile]: 0xe84057, // red
  [SignalType.Neutral]: 0xd4c35c, // amber
};

export const MAX_SIGNALS = 18;
export const SIGNAL_LIFESPAN = 4; // seconds
export const SPAWN_INTERVAL = 0.6; // seconds between spawns

export interface Signal {
  type: SignalType;
  x: number;
  z: number;
  birth: number;
  light: THREE.PointLight;
  sprite: THREE.Sprite;
}

// ── Glow sprite texture (procedural) ───────────────────────

export function createGlowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.3, "rgba(255,255,255,0.6)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ── Wave function (shared between mesh + signals) ──────────

export function waveY(x: number, z: number, t: number): number {
  return (
    Math.sin(x * 0.4 + t * 0.6) * 0.35 +
    Math.sin(z * 0.55 + t * 0.45) * 0.25 +
    Math.sin((x + z) * 0.3 + t * 0.35) * 0.15 +
    Math.sin(x * 0.9 - t * 0.25) * 0.1
  );
}
