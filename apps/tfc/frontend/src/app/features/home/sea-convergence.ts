import * as THREE from 'three';
import { waveY } from './sea-signals';

const GLOW_DURATION = 1.5;
const EXPLODE_DURATION = 3;
const LIFESPAN = GLOW_DURATION + EXPLODE_DURATION;
const VECTOR_LENGTH = 3;
const HALO_MAX_RADIUS = 3.5;

export const CONVERGENCE_INTERVAL = 4;

export interface Convergence {
  x: number;
  z: number;
  birth: number;
  vectors: THREE.Line[];
  dot: THREE.Sprite;
  dotLight: THREE.PointLight;
  halo: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
}

export function createConvergence(
  scene: THREE.Scene,
  glowTexture: THREE.Texture,
  themeColor: THREE.Color,
  t: number,
): Convergence {
  const x = (Math.random() - 0.5) * 12;
  const z = (Math.random() - 0.5) * 6;
  const y = waveY(x, z, t) + 0.3;
  const center = new THREE.Vector3(x, y, z);

  const vectors: THREE.Line[] = [];
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + Math.random() * 0.5;
    const elev = (Math.random() - 0.3) * Math.PI * 0.4;
    const dir = new THREE.Vector3(
      Math.cos(angle) * Math.cos(elev),
      Math.sin(elev),
      Math.sin(angle) * Math.cos(elev),
    );
    const origin = center.clone().add(dir.multiplyScalar(VECTOR_LENGTH));
    const geo = new THREE.BufferGeometry().setFromPoints([origin, center]);
    const mat = new THREE.LineBasicMaterial({
      color: themeColor,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    vectors.push(line);
  }

  const dotMat = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const dot = new THREE.Sprite(dotMat);
  dot.position.copy(center);
  dot.scale.set(0.1, 0.1, 1);
  scene.add(dot);

  const dotLight = new THREE.PointLight(0xffffff, 0, 8);
  dotLight.position.copy(center);
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
  halo.position.copy(center);
  halo.scale.set(0.01, 0.01, 0.01);
  scene.add(halo);

  return { x, z, birth: t, vectors, dot, dotLight, halo };
}

/** Returns false when the convergence has expired and should be removed. */
export function updateConvergence(c: Convergence, t: number): boolean {
  const age = t - c.birth;
  if (age > LIFESPAN) return false;

  const y = waveY(c.x, c.z, t) + 0.3;
  c.dot.position.y = y;
  c.dotLight.position.y = y;
  c.halo.position.y = y;

  if (age < GLOW_DURATION) {
    const vecFade = Math.min(age / 0.5, 1);
    for (const v of c.vectors) {
      (v.material as THREE.LineBasicMaterial).opacity = vecFade * 0.55;
    }
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

  for (const v of c.vectors) {
    (v.material as THREE.LineBasicMaterial).opacity = dotFade * 0.35;
  }
  return true;
}

export function disposeConvergence(
  scene: THREE.Scene,
  c: Convergence,
): void {
  for (const v of c.vectors) {
    scene.remove(v);
    v.geometry.dispose();
    (v.material as THREE.LineBasicMaterial).dispose();
  }
  scene.remove(c.dot);
  (c.dot.material as THREE.SpriteMaterial).dispose();
  scene.remove(c.dotLight);
  scene.remove(c.halo);
  c.halo.geometry.dispose();
  c.halo.material.dispose();
}
