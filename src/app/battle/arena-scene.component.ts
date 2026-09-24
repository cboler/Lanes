import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import type { BufferGeometry, Material } from 'three';

@Component({
  selector: 'app-arena-scene',
  standalone: true,
  template: '<canvas #canvas aria-hidden="true"></canvas>',
  styles: `
    :host {
      position: absolute;
      inset: 0;
      display: block;
      overflow: hidden;
      pointer-events: none;
      contain: strict;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
      visibility: hidden;
      opacity: 0.82;
    }
  `,
  host: { 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArenaSceneComponent {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private disposeScene: (() => void) | undefined;

  constructor() {
    // Render hooks run in the browser only; the CSS arena remains the fallback.
    afterNextRender(() => void this.createScene());
    this.destroyRef.onDestroy(() => this.disposeScene?.());
  }

  private async createScene(): Promise<void> {
    if (typeof WebGL2RenderingContext === 'undefined' || typeof ResizeObserver === 'undefined') {
      return;
    }

    try {
      const THREE = await import('three');
      if (this.destroyRef.destroyed) return;

      const canvas = this.canvas().nativeElement;
      const context = canvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
      if (!context) return;

      this.disposeScene = () => context.getExtension('WEBGL_lose_context')?.loseContext();
      const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true });
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      const board = new THREE.Group();
      scene.add(board);

      // No camera yaw: world X stays horizontal, so terrain matches the DOM lanes.
      const camera = new THREE.OrthographicCamera(-10, 10, 4.5, -4.5, 0.1, 60);
      camera.position.set(0, -7, 16);
      camera.lookAt(0, 0, 0);

      const geometries = new Set<BufferGeometry>();
      const materials = new Set<Material>();
      const observer = new ResizeObserver(() => render());
      let disposed = false;
      const contextLost = (event: Event) => {
        event.preventDefault();
        this.disposeScene?.();
      };
      this.disposeScene = () => {
        if (disposed) return;
        disposed = true;
        observer.disconnect();
        canvas.removeEventListener('webglcontextlost', contextLost);
        canvas.style.visibility = 'hidden';
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        scene.clear();
        renderer.dispose();
        renderer.forceContextLoss();
      };
      canvas.addEventListener('webglcontextlost', contextLost);

      const material = (color: number, emissive = 0x000000) => {
        const result = new THREE.MeshStandardMaterial({
          color,
          emissive,
          emissiveIntensity: 0.55,
          roughness: 0.95,
          flatShading: true,
        });
        materials.add(result);
        return result;
      };
      const rock = material(0x293640);
      const slate = material(0x45535a);
      const moss = material(0x303f36);
      const stone = [material(0x53615f), material(0x485755), material(0x3d4c4b)];
      const bronze = material(0x777047);
      const blueBeacon = material(0x70b8c9, 0x247eac);
      const redBeacon = material(0xce8b68, 0x982e23);
      const cube = new THREE.BoxGeometry(1, 1, 1);
      const crystal = new THREE.OctahedronGeometry(0.16);
      geometries.add(cube);
      geometries.add(crystal);

      const block = (
        surface: Material,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
        depth: number,
      ) => {
        const mesh = new THREE.Mesh(cube, surface);
        mesh.position.set(x, y, z);
        mesh.scale.set(width, height, depth);
        board.add(mesh);
        return mesh;
      };

      // Shared geometry and a small, fixed set of materials keep the static scene light.
      for (let lane = 0; lane < 3; lane++) {
        const y = (1 - lane) * 3;
        block(rock, 0, y, -0.28, 20.6, 2.85, 0.55);
        block(moss, 0, y, 0.025, 20.4, 2.69, 0.1);
        block(slate, 0, y - 1.31, 0.02, 20.5, 0.12, 0.28);
        block(bronze, 0, y - 1.29, 0.17, 20.5, 0.025, 0.025);

        for (let column = 0; column < 19; column++) {
          for (let row = 0; row < 2; row++) {
            const variation = (column * 7 + lane * 3 + row) % 5;
            const tile = block(
              stone[(column + row + lane) % stone.length],
              -9.5 + column * 1.04 + row * 0.18,
              y - 0.5 + row * 0.77,
              0.095,
              0.91 + variation * 0.015,
              0.68,
              0.08,
            );
            tile.rotation.z = (variation - 2) * 0.009;
          }
        }

        for (const side of [-1, 1]) {
          const x = side * 9.25;
          block(rock, x, y + 0.94, 0.18, 0.44, 0.4, 0.35);
          block(bronze, x, y + 0.94, 0.4, 0.25, 0.24, 0.11);
          const beacon = new THREE.Mesh(crystal, side < 0 ? blueBeacon : redBeacon);
          beacon.position.set(x, y + 0.94, 0.66);
          beacon.scale.z = 1.7;
          board.add(beacon);

          for (let fragment = 0; fragment < 4; fragment++) {
            const rubble = block(
              fragment % 2 ? moss : slate,
              side * (6.8 + fragment * 0.6),
              y + 1.08 - (fragment % 2) * 0.11,
              0.11,
              0.23 + fragment * 0.04,
              0.16,
              0.16,
            );
            rubble.rotation.z = fragment * 0.45;
          }
        }
      }

      scene.add(new THREE.AmbientLight(0x99afba, 1.15));
      const sun = new THREE.DirectionalLight(0xf0dbc0, 2.1);
      sun.position.set(-6, 8, 12);
      scene.add(sun);

      const render = () => {
        if (disposed || this.destroyRef.destroyed) return;
        const { width, height } = this.host.nativeElement.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;

        try {
          // Preserve three equal lane heights at every aspect ratio. Only the board
          // width scales; the camera never crops a lane on portrait screens.
          const visibleHeight = 9 * (16 / Math.hypot(7, 16));
          const visibleWidth = visibleHeight * (width / height);
          camera.left = -visibleWidth / 2;
          camera.right = visibleWidth / 2;
          camera.top = visibleHeight / 2;
          camera.bottom = -visibleHeight / 2;
          camera.updateProjectionMatrix();
          board.scale.x = visibleWidth / 20;
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
          renderer.setSize(Math.round(width), Math.round(height), false);
          renderer.render(scene, camera);
          canvas.style.visibility = 'visible';
        } catch {
          this.disposeScene?.();
        }
      };

      observer.observe(this.host.nativeElement);
      // The arena has no idle animation loop, including for reduced-motion users.
      render();
    } catch {
      // Loading or GPU failure leaves the existing CSS battlefield fully playable.
      this.disposeScene?.();
    }
  }
}
