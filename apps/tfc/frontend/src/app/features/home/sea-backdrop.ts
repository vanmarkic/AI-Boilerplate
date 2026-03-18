import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';
import {
  createGlowTexture,
  MAX_SIGNALS,
  Signal,
  SIGNAL_COLORS,
  SIGNAL_LIFESPAN,
  SignalType,
  SPAWN_INTERVAL,
  waveY,
} from './sea-signals';

@Component({
  selector: 'tfc-sea-backdrop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: block;
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  `],
  template: `<canvas #canvas></canvas>`,
})
export class SeaBackdrop implements OnDestroy {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private plane!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private animationId = 0;
  private resizeObserver!: ResizeObserver;

  private signals: Signal[] = [];
  private nextSpawn = 0;
  private glowTexture!: THREE.Texture;

  private get themeColor(): THREE.Color {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-primary')
      .trim();
    if (raw.startsWith('oklch')) {
      return new THREE.Color(0x1ac5c5);
    }
    return new THREE.Color(raw || 0x1ac5c5);
  }

  constructor(private ngZone: NgZone) {
    afterNextRender(() => {
      this.initScene();
      this.ngZone.runOutsideAngular(() => this.animate(0));
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);
    this.resizeObserver?.disconnect();
    this.renderer?.dispose();
    this.plane?.geometry.dispose();
    this.plane?.material.dispose();
    this.glowTexture?.dispose();
    for (const s of this.signals) {
      this.scene.remove(s.light, s.sprite);
      s.sprite.material.dispose();
    }
  }

  private initScene(): void {
    const canvas = this.canvasRef().nativeElement;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);

    const bgColor = new THREE.Color(0x061218);
    this.scene = new THREE.Scene();
    this.scene.background = bgColor;

    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
    this.camera.position.set(0, 1.6, 5);
    this.camera.lookAt(0, -0.4, -2);

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(-3, 5, 4);
    this.scene.add(directional);

    const primary = this.themeColor;
    const pointLight = new THREE.PointLight(primary, 2.5, 20);
    pointLight.position.set(0, 2, 3);
    this.scene.add(pointLight);

    const pointLight2 = new THREE.PointLight(primary, 1.5, 15);
    pointLight2.position.set(-4, 1, -2);
    this.scene.add(pointLight2);

    const geometry = new THREE.PlaneGeometry(24, 14, 18, 12);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshBasicMaterial({
      color: primary,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });

    this.plane = new THREE.Mesh(geometry, material);
    this.plane.position.y = -0.3;
    this.scene.add(this.plane);

    this.scene.fog = new THREE.Fog(bgColor, 8, 16);
    this.glowTexture = createGlowTexture();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas);
  }

  // ── Signals ────────────────────────────────────────────

  private spawnSignal(t: number): void {
    const types = [SignalType.Friendly, SignalType.Hostile, SignalType.Neutral];
    const type = types[Math.floor(Math.random() * types.length)];
    const color = SIGNAL_COLORS[type];

    const x = (Math.random() - 0.5) * 14;
    const z = (Math.random() - 0.5) * 8;

    const light = new THREE.PointLight(color, 0, 5);
    light.position.set(x, waveY(x, z, t), z);
    this.scene.add(light);

    const mat = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.8, 0.8, 1);
    sprite.position.copy(light.position);
    this.scene.add(sprite);

    this.signals.push({ type, x, z, birth: t, light, sprite });
  }

  private updateSignals(t: number): void {
    if (t >= this.nextSpawn && this.signals.length < MAX_SIGNALS) {
      this.spawnSignal(t);
      this.nextSpawn = t + SPAWN_INTERVAL + Math.random() * SPAWN_INTERVAL;
    }

    for (let i = this.signals.length - 1; i >= 0; i--) {
      const s = this.signals[i];
      const age = t - s.birth;
      const life = age / SIGNAL_LIFESPAN;

      if (life >= 1) {
        this.scene.remove(s.light, s.sprite);
        (s.sprite.material as THREE.SpriteMaterial).dispose();
        this.signals.splice(i, 1);
        continue;
      }

      const fade = life < 0.15
        ? life / 0.15
        : life > 0.7
          ? (1 - life) / 0.3
          : 1;

      const pulse = 1 + Math.sin(age * 4) * 0.2;
      const intensity = fade * pulse;

      const y = waveY(s.x, s.z, t);
      s.light.position.set(s.x, y + 0.25, s.z);
      s.light.intensity = intensity * 3;
      s.sprite.position.set(s.x, y + 0.25, s.z);
      (s.sprite.material as THREE.SpriteMaterial).opacity = intensity * 0.9;
      s.sprite.scale.setScalar(0.5 + intensity * 0.4);
    }
  }

  // ── Core loop ──────────────────────────────────────────

  private handleResize(): void {
    const canvas = this.canvasRef().nativeElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  private animate(time: number): void {
    this.animationId = requestAnimationFrame((t) => this.animate(t));

    const t = time * 0.001;
    const positions = this.plane.geometry.attributes['position'];
    const count = positions.count;

    for (let i = 0; i < count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      positions.setY(i, waveY(x, z, t));
    }

    positions.needsUpdate = true;
    this.plane.geometry.computeVertexNormals();

    this.updateSignals(t);
    this.renderer.render(this.scene, this.camera);
  }
}
