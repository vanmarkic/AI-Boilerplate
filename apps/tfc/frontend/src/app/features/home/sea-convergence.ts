import * as THREE from 'three';
import { waveY } from './sea-signals';

const GLOW_DURATION = 1.5;
const EXPLODE_DURATION = 3;
const LIFESPAN = GLOW_DURATION + EXPLODE_DURATION;
const HALO_MAX_RADIUS = 3.5;

export const CONVERGENCE_INTERVAL = 4;

export interface Convergence {
  x: number;
  z: number;
  birth: number;
  dot: THREE.Sprite;
  dotLight: THREE.PointLight;
  halo: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
}

/**
 * Pick a random interior vertex from the plane grid.
 * Interior vertices sit where 6 triangles meet.
 */
function pickInteriorVertex(
  geo: THREE.PlaneGeometry,
  widthSegs: number,
  heightSegs: number,
): { x: number; z: number } {
  const cols = widthSegs + 1;
  const col = 1 + Math.floor(Math.random() * (widthSegs - 1));
  const row = 1 + Math.floor(Math.random() * (heightSegs - 1));
  const idx = row * cols + col;
  const pos = geo.attributes['position'];
  return { x: pos.getX(idx), z: pos.getZ(idx) };
}

export function createConvergence(
  scene: THREE.Scene,
  glowTexture: THREE.Texture,
  themeColor: THREE.Color,
  planeGeo: THREE.PlaneGeometry,
  widthSegs: number,
  heightSegs: number,
  t: number,
): Convergence {
  const { x, z } = pickInteriorVertex(planeGeo, widthSegs, heightSegs);
  const y = waveY(x, z, t);

  const dotMat = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const dot = new THREE.Sprite(dotMat);
  dot.position.set(x, y, z);
  dot.scale.set(0.1, 0.1, 1);
  scene.add(dot);

  const dotLight = new THREE.PointLight(0xffffff, 0, 8);
  dotLight.position.set(x, y, z);
  scene.add(dotLight);

  const haloGeo = new THREE.SphereGeometry(1, 20, 14);
  const haloMat = new THREE.MeshBasicMaterial({
    color: themeColor,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
    wireframe: true,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.position.set(x, y, z);
  halo.scale.set(0.01, 0.01, 0.01);
  scene.add(halo);

  return { x, z, birth: t, dot, dotLight, halo };
}

/** Returns false when the convergence has expired and should be removed. */
export function updateConvergence(c: Convergence, t: number): boolean {
  const age = t - c.birth;
  if (age > LIFESPAN) return false;

  const y = waveY(c.x, c.z, t);
  c.dot.position.y = y;
  c.dotLight.position.y = y;
  c.halo.position.y = y;

  if (age < GLOW_DURATION) {
    const glow = (age / GLOW_DURATION) ** 2;
    (c.dot.material as THREE.SpriteMaterial).opacity = glow * 0.95;
    c.dot.scale.setScalar(0.2 + glow * 0.7);
    c.dotLight.intensity = glow * 6;
    return true;
  }

  const ep = (age - GLOW_DURATION) / EXPLODE_DURATION;
  const eased = 1 - (1 - ep) ** 2;

  const scale = eased * HALO_MAX_RADIUS;
  c.halo.scale.set(scale, scale, scale);
  c.halo.material.opacity = (1 - eased) * 0.45;

  const dotFade = 1 - ep;
  (c.dot.material as THREE.SpriteMaterial).opacity = dotFade * 0.95;
  c.dot.scale.setScalar(0.9 * dotFade);
  c.dotLight.intensity = dotFade * 6;

  return true;
}

export function disposeConvergence(
  scene: THREE.Scene,
  c: Convergence,
): void {
  scene.remove(c.dot);
  (c.dot.material as THREE.SpriteMaterial).dispose();
  scene.remove(c.dotLight);
  scene.remove(c.halo);
  c.halo.geometry.dispose();
  c.halo.material.dispose();
}
