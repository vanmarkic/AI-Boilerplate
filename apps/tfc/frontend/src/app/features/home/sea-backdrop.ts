import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  viewChild,
} from "@angular/core";
import * as THREE from "three";
import {
  Lightning,
  LIGHTNING_INTERVAL,
  createLightning,
  disposeLightning,
  updateLightning,
} from "./sea-lightning";
import { createGlowTexture } from "./sea-signals";

const FRAME_INTERVAL = 1000 / 30; // 30fps cap

const WAVE_VERTEX_SHADER = `
uniform float uTime;
void main() {
  vec3 pos = position;
  pos.y = sin(pos.x * 0.4 + uTime * 0.6) * 0.35
        + sin(pos.z * 0.55 + uTime * 0.45) * 0.25
        + sin((pos.x + pos.z) * 0.3 + uTime * 0.35) * 0.15
        + sin(pos.x * 0.9 - uTime * 0.25) * 0.1;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const WAVE_FRAGMENT_SHADER = `
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  gl_FragColor = vec4(uColor, uOpacity);
}
`;

@Component({
  selector: "tfc-sea-backdrop",
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
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
    `,
  ],
  template: `<canvas #canvas></canvas>`,
})
export class SeaBackdrop implements OnDestroy {
  private readonly canvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>("canvas");
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private plane!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private animationId = 0;
  private lastFrameTime = 0;
  private resizeObserver!: ResizeObserver;

  private glowTexture!: THREE.Texture;

  private lightnings: Lightning[] = [];
  private nextLightning = 3;

  private get themeColor(): THREE.Color {
    const style = getComputedStyle(document.documentElement);
    const hex = style.getPropertyValue("--sw-sea-primary-hex").trim();
    if (hex && hex.startsWith("#")) {
      return new THREE.Color(hex);
    }
    const raw = style.getPropertyValue("--color-primary").trim();
    if (raw && !raw.startsWith("oklch")) {
      return new THREE.Color(raw);
    }
    return new THREE.Color(0x1ac5c5);
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
    for (const l of this.lightnings) {
      disposeLightning(this.scene, l);
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

    const style = getComputedStyle(document.documentElement);
    const bgHex = style.getPropertyValue("--sw-sea-bg-hex").trim();
    const bgColor = new THREE.Color(
      bgHex && bgHex.startsWith("#") ? bgHex : 0x061218,
    );
    this.scene = new THREE.Scene();
    this.scene.background = bgColor;
    this.camera = new THREE.PerspectiveCamera(27, w / h, 0.1, 100);
    this.camera.position.set(0, 6, 5);
    this.camera.lookAt(0, -0.4, -2);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(-3, 5, 4);
    this.scene.add(dir);

    const primary = this.themeColor;
    const pl1 = new THREE.PointLight(primary, 2.5, 20);
    pl1.position.set(0, 2, 3);
    const pl2 = new THREE.PointLight(primary, 1.5, 15);
    pl2.position.set(-4, 1, -2);
    this.scene.add(pl1, pl2);

    const geo = new THREE.PlaneGeometry(24, 14, 180, 120);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: primary },
        uOpacity: { value: 0.06 },
      },
      vertexShader: WAVE_VERTEX_SHADER,
      fragmentShader: WAVE_FRAGMENT_SHADER,
      wireframe: true,
      transparent: true,
    });
    this.plane = new THREE.Mesh(geo, mat);
    this.plane.position.y = -0.3;
    this.scene.add(this.plane);

    this.scene.fog = new THREE.Fog(bgColor, 8, 16);
    this.glowTexture = createGlowTexture();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas);
  }

  // ── Lightnings ──────────────────────────────────────────

  private updateLightnings(t: number): void {
    if (t >= this.nextLightning) {
      this.lightnings.push(createLightning(this.scene, this.plane.geometry, t));
      this.nextLightning = t + LIGHTNING_INTERVAL + Math.random() * 2;
    }
    for (let i = this.lightnings.length - 1; i >= 0; i--) {
      if (!updateLightning(this.lightnings[i], t)) {
        disposeLightning(this.scene, this.lightnings[i]);
        this.lightnings.splice(i, 1);
      }
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

    if (time - this.lastFrameTime < FRAME_INTERVAL) return;
    this.lastFrameTime = time;

    const t = time * 0.001;
    this.plane.material.uniforms["uTime"].value = t;

    this.updateLightnings(t);
    this.renderer.render(this.scene, this.camera);
  }
}
