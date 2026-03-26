import * as THREE from "three";
import { createGlowTexture, waveY } from "./sea-signals";

/** How often a new lightning bolt spawns (seconds). */
export const LIGHTNING_INTERVAL = 0.8;

/** How long the trail lingers after the head passes (seconds). */
const TRAIL_FADE = 1.5;
/** Slow global fade-out after trail is done (seconds). */
const GLOBAL_FADE = 3.0;
/** Speed: waypoints per second the head travels. */
const TRAVEL_SPEED = 150;
/** Max edges to walk along the wireframe. */
const PATH_EDGES = 400;

const BOLT_COLOR = 0xe84057; // hostile red — supply-chain attack

export interface Lightning {
  birth: number;
  line: THREE.Line;
  head: THREE.Sprite;
  headLight: THREE.PointLight;
  waypoints: { x: number; z: number }[];
  color: THREE.Color;
}

/** Grid-edge neighbours: 4 cardinal + 4 diagonal (follow wireframe lines). */
const EDGE_DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function tracePath(
  positions: THREE.BufferAttribute,
  cols: number,
  rows: number,
): { x: number; z: number }[] {
  const path: { x: number; z: number }[] = [];
  const visited = new Set<number>();
  const key = (c: number, r: number) => r * cols + c;

  // All 8 directions for varied bolt angles
  const [headCol, headRow] =
    EDGE_DIRS[Math.floor(Math.random() * EDGE_DIRS.length)];

  // Start at the opposite edge so the bolt traverses the sea
  let col: number, row: number;
  if (headCol > 0) col = 0;
  else if (headCol < 0) col = cols - 1;
  else col = Math.floor(Math.random() * cols);
  if (headRow > 0) row = 0;
  else if (headRow < 0) row = rows - 1;
  else row = Math.floor(Math.random() * rows);

  visited.add(key(col, row));
  path.push({
    x: positions.getX(key(col, row)),
    z: positions.getZ(key(col, row)),
  });

  for (let i = 0; i < PATH_EDGES; i++) {
    let moved = false;

    if (Math.random() < 0.6) {
      const fc = col + headCol;
      const fr = row + headRow;
      if (
        fc >= 0 &&
        fc < cols &&
        fr >= 0 &&
        fr < rows &&
        !visited.has(key(fc, fr))
      ) {
        col = fc;
        row = fr;
        moved = true;
      }
    }

    if (!moved) {
      const shuffled = [...EDGE_DIRS].sort(() => Math.random() - 0.5);
      for (const [dc, dr] of shuffled) {
        const nc = col + dc;
        const nr = row + dr;
        if (
          nc >= 0 &&
          nc < cols &&
          nr >= 0 &&
          nr < rows &&
          !visited.has(key(nc, nr))
        ) {
          col = nc;
          row = nr;
          moved = true;
          break;
        }
      }
    }

    if (!moved) break;

    visited.add(key(col, row));
    const vi = key(col, row);
    path.push({ x: positions.getX(vi), z: positions.getZ(vi) });

    if (
      (headCol === 1 && col >= cols - 2) ||
      (headCol === -1 && col <= 1) ||
      (headRow === 1 && row >= rows - 2) ||
      (headRow === -1 && row <= 1)
    ) {
      break;
    }
  }

  return path;
}

let sharedGlow: THREE.Texture | null = null;

export function createLightning(
  scene: THREE.Scene,
  planeGeo: THREE.PlaneGeometry,
  t: number,
): Lightning {
  const params = planeGeo.parameters;
  const cols = params.widthSegments + 1;
  const rows = params.heightSegments + 1;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- THREE.js geometry attributes are always BufferAttribute
  const positions = planeGeo.attributes["position"] as THREE.BufferAttribute;
  const waypoints = tracePath(positions, cols, rows);
  const n = waypoints.length;

  const style = getComputedStyle(document.documentElement);
  const lightningHex = style.getPropertyValue("--sw-sea-lightning-hex").trim();
  const flashColor =
    lightningHex && lightningHex.startsWith("#")
      ? new THREE.Color(lightningHex)
      : new THREE.Color(BOLT_COLOR);

  // Position buffer
  const verts = new Float32Array(n * 3);
  // Per-vertex color buffer (for trail fade)
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const wp = waypoints[i];
    const off = i * 3;
    verts[off] = wp.x;
    verts[off + 1] = waveY(wp.x, wp.z, t);
    verts[off + 2] = wp.z;
    colors[off] = 0;
    colors[off + 1] = 0;
    colors[off + 2] = 0;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const line = new THREE.Line(geo, mat);
  line.position.y = -0.3;
  scene.add(line);

  // Travelling glow sprite
  if (!sharedGlow) sharedGlow = createGlowTexture();
  const spriteMat = new THREE.SpriteMaterial({
    map: sharedGlow,
    color: flashColor,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const head = new THREE.Sprite(spriteMat);
  head.scale.set(0.4, 0.4, 1);
  const wp0 = waypoints[0];
  head.position.set(wp0.x, waveY(wp0.x, wp0.z, t) - 0.3 + 0.15, wp0.z);
  scene.add(head);

  // Point light follows the head
  const headLight = new THREE.PointLight(flashColor, 0, 4);
  headLight.position.copy(head.position);
  scene.add(headLight);

  return { birth: t, line, head, headLight, waypoints, color: flashColor };
}

/** Returns false when the bolt has fully faded. */
export function updateLightning(l: Lightning, t: number): boolean {
  const age = t - l.birth;
  const n = l.waypoints.length;
  const travelDuration = n / TRAVEL_SPEED;
  const totalLife = travelDuration + TRAIL_FADE + GLOBAL_FADE;

  if (age > totalLife) return false;

  // Global opacity: full during travel+trail, then slowly fade entire bolt
  const globalFadeStart = travelDuration + TRAIL_FADE;
  const globalOpacity =
    age > globalFadeStart
      ? Math.max(0, 1 - (age - globalFadeStart) / GLOBAL_FADE)
      : 1;

  // Current head position (fractional index into waypoints)
  const headIdx = Math.min(age * TRAVEL_SPEED, n - 1);
  const headI = Math.floor(headIdx);

  // Update positions to ride the wave
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- THREE.js geometry attributes
  const posBuf = l.line.geometry.attributes[
    "position"
  ] as THREE.BufferAttribute;
  for (let i = 0; i < n; i++) {
    const wp = l.waypoints[i];
    const off = i * 3;
    posBuf.array[off] = wp.x;
    posBuf.array[off + 1] = waveY(wp.x, wp.z, t);
    posBuf.array[off + 2] = wp.z;
  }
  posBuf.needsUpdate = true;

  // Update per-vertex colors: bright at head, fading trail behind
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- THREE.js geometry attributes
  const colBuf = l.line.geometry.attributes["color"] as THREE.BufferAttribute;
  const r = l.color.r;
  const g = l.color.g;
  const b = l.color.b;

  for (let i = 0; i < n; i++) {
    const off = i * 3;
    if (i > headI) {
      // Ahead of head — invisible
      colBuf.array[off] = 0;
      colBuf.array[off + 1] = 0;
      colBuf.array[off + 2] = 0;
    } else {
      // Behind head — fade based on distance from head
      const dist = headI - i;
      const timeSincePassed = dist / TRAVEL_SPEED;
      const fade = Math.max(0, 1 - timeSincePassed / TRAIL_FADE);
      const brightness = fade * globalOpacity;
      colBuf.array[off] = r * brightness;
      colBuf.array[off + 1] = g * brightness;
      colBuf.array[off + 2] = b * brightness;
    }
  }
  colBuf.needsUpdate = true;

  // Move head sprite + light
  const wp = l.waypoints[headI];
  const hy = waveY(wp.x, wp.z, t) - 0.3 + 0.15;
  l.head.position.set(wp.x, hy, wp.z);
  l.headLight.position.set(wp.x, hy, wp.z);

  // Head brightness: full while travelling, fade after done
  const headAlive = age < travelDuration;
  const headOpacity =
    (headAlive
      ? 0.4
      : Math.max(0, 1 - (age - travelDuration) / TRAIL_FADE) * 0.2) *
    globalOpacity;
  (l.head.material as THREE.SpriteMaterial).opacity = headOpacity;
  l.headLight.intensity = (headAlive ? 2 : headOpacity * 2) * globalOpacity;

  return true;
}

export function disposeLightning(scene: THREE.Scene, l: Lightning): void {
  scene.remove(l.line);
  l.line.geometry.dispose();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Line2 material is always Material
  (l.line.material as THREE.Material).dispose();
  scene.remove(l.head);
  (l.head.material as THREE.SpriteMaterial).dispose();
  scene.remove(l.headLight);
}
