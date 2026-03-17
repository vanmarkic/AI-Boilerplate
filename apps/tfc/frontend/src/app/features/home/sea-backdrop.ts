import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';

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
export class SeaBackdrop implements OnInit, OnDestroy {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private plane!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private animationId = 0;
  private resizeObserver!: ResizeObserver;

  /** Read the CSS custom property --color-primary from the page theme. */
  private get themeColor(): THREE.Color {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-primary')
      .trim();
    // oklch values aren't parseable by Three.js — fall back to a cyan tone
    // that matches tfc-noi4 phosphor theme.
    if (raw.startsWith('oklch')) {
      return new THREE.Color(0x1ac5c5);
    }
    return new THREE.Color(raw || 0x1ac5c5);
  }

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    this.initScene();
    this.ngZone.runOutsideAngular(() => this.animate(0));
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);
    this.resizeObserver?.disconnect();
    this.renderer?.dispose();
    this.plane?.geometry.dispose();
    this.plane?.material.dispose();
  }

  private initScene(): void {
    const canvas = this.canvasRef().nativeElement;
    const { clientWidth: w, clientHeight: h } = canvas;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);

    // Scene — background matches the theme so fog blends into page
    const bgColor = new THREE.Color(0x061218);
    this.scene = new THREE.Scene();
    this.scene.background = bgColor;

    // Camera — low angle looking across the water surface
    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
    this.camera.position.set(0, 1.6, 5);
    this.camera.lookAt(0, -0.4, -2);

    // Lighting — brighter to make polygons readable
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(-3, 5, 4);
    this.scene.add(directional);

    // Colored point light for phosphor glow on wave peaks
    const primary = this.themeColor;
    const pointLight = new THREE.PointLight(primary, 2.5, 20);
    pointLight.position.set(0, 2, 3);
    this.scene.add(pointLight);

    // Second point light for depth
    const pointLight2 = new THREE.PointLight(primary, 1.5, 15);
    pointLight2.position.set(-4, 1, -2);
    this.scene.add(pointLight2);

    // Sea plane — coarse grid for visible polygons
    const geometry = new THREE.PlaneGeometry(20, 12, 40, 25);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshBasicMaterial({
      color: primary,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });

    this.plane = new THREE.Mesh(geometry, material);
    this.plane.position.y = -0.3;
    this.scene.add(this.plane);

    // Fog fades far edge into background
    this.scene.fog = new THREE.Fog(bgColor, 6, 14);

    // Resize handling
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas);
  }

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

    const t = time * 0.001; // seconds
    const positions = this.plane.geometry.attributes['position'];
    const count = positions.count;

    for (let i = 0; i < count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);

      // Layered sine waves — taller, more dramatic
      const y =
        Math.sin(x * 0.5 + t * 0.7) * 0.45 +
        Math.sin(z * 0.7 + t * 0.5) * 0.3 +
        Math.sin((x + z) * 0.35 + t * 0.4) * 0.2 +
        Math.sin(x * 1.2 - t * 0.3) * 0.1;

      positions.setY(i, y);
    }

    positions.needsUpdate = true;
    this.plane.geometry.computeVertexNormals();

    this.renderer.render(this.scene, this.camera);
  }
}
