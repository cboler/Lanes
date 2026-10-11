import * as THREE from 'three';
import { seededRandom } from '../core/models/mercenary.model';

// Procedural textures (seeded, so the arena looks the same every visit)

export function canvasTexture(
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
  color = true,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new THREE.CanvasTexture(canvas);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function radial(inner: string, outer: string, size = 64) {
  return canvasTexture(size, size, (c) => {
    const gradient = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(1, outer);
    c.fillStyle = gradient;
    c.fillRect(0, 0, size, size);
  });
}

export function groundTexture() {
  const size = 512;
  const random = seededRandom(20160628);
  const texture = canvasTexture(size, size, (c) => {
    c.fillStyle = '#39342b';
    c.fillRect(0, 0, size, size);
    const palette = ['#4a4233', '#2c2821', '#57503f', '#3a4531', '#4d4b45', '#2f3a2b'];
    // Each blotch is drawn at its wrapped copies so the texture tiles seamlessly.
    const wrapped = (x: number, y: number, draw: (x: number, y: number) => void) => {
      for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) draw(x + dx, y + dy);
    };
    for (let i = 0; i < 1100; i++) {
      const x = random() * size;
      const y = random() * size;
      const rx = 3 + random() ** 2 * 38;
      const ry = rx * (0.45 + random() * 0.4);
      c.globalAlpha = 0.08 + random() * 0.2;
      c.fillStyle = palette[Math.floor(random() * palette.length)];
      wrapped(x, y, (px, py) => {
        c.beginPath();
        c.ellipse(px, py, rx, ry, random() * Math.PI, 0, Math.PI * 2);
        c.fill();
      });
    }
    for (let i = 0; i < 260; i++) {
      const x = random() * size;
      const y = random() * size;
      const r = 1 + random() * 3.5;
      c.globalAlpha = 0.35 + random() * 0.35;
      c.fillStyle = random() < 0.5 ? '#6b6352' : '#1f1c17';
      wrapped(x, y, (px, py) => {
        c.beginPath();
        c.ellipse(px, py, r * 1.3, r, 0, 0, Math.PI * 2);
        c.fill();
      });
    }
    c.globalAlpha = 1;
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 3.5);
  return texture;
}

export function laneTexture(label: string) {
  return canvasTexture(1024, 128, (c) => {
    const edge = c.createLinearGradient(0, 0, 0, 128);
    edge.addColorStop(0, 'rgba(10, 8, 6, 0.55)');
    edge.addColorStop(0.07, 'rgba(214, 190, 140, 0.22)');
    edge.addColorStop(0.13, 'rgba(0, 0, 0, 0)');
    edge.addColorStop(0.87, 'rgba(0, 0, 0, 0)');
    edge.addColorStop(0.93, 'rgba(214, 190, 140, 0.18)');
    edge.addColorStop(1, 'rgba(10, 8, 6, 0.55)');
    c.fillStyle = edge;
    c.fillRect(0, 0, 1024, 128);
    const fade = c.createLinearGradient(0, 0, 1024, 0);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(0.04, 'rgba(0,0,0,0)');
    fade.addColorStop(0.96, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = fade;
    c.fillRect(0, 0, 1024, 128);
    c.globalCompositeOperation = 'source-over';
    c.font = 'bold 76px Georgia, serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 6;
    c.strokeStyle = 'rgba(12, 9, 5, 0.6)';
    c.fillStyle = 'rgba(222, 186, 96, 0.55)';
    // Stretched horizontally: the camera's low angle compresses the lane's depth.
    c.setTransform(0.55, 0, 0, 1, 0, 0);
    c.strokeText(label, 70 / 0.55, 66);
    c.fillText(label, 70 / 0.55, 66);
  });
}

function stripTexture() {
  return canvasTexture(256, 64, (c) => {
    const along = c.createLinearGradient(0, 0, 256, 0);
    along.addColorStop(0, 'rgba(255,255,255,0)');
    along.addColorStop(0.12, 'rgba(255,255,255,1)');
    along.addColorStop(0.88, 'rgba(255,255,255,1)');
    along.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = along;
    c.fillRect(0, 0, 256, 64);
    c.globalCompositeOperation = 'destination-in';
    const across = c.createLinearGradient(0, 0, 0, 64);
    across.addColorStop(0, 'rgba(0,0,0,0.15)');
    across.addColorStop(0.5, 'rgba(0,0,0,1)');
    across.addColorStop(1, 'rgba(0,0,0,0.15)');
    c.fillStyle = across;
    c.fillRect(0, 0, 256, 64);
  });
}

function ringTexture() {
  return canvasTexture(128, 128, (c) => {
    c.shadowColor = '#fff';
    c.shadowBlur = 10;
    c.strokeStyle = '#fff';
    c.lineWidth = 7;
    c.beginPath();
    c.arc(64, 64, 50, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 0.18;
    c.fillStyle = '#fff';
    c.fill();
  });
}

function arrowTexture() {
  return canvasTexture(96, 24, (c) => {
    c.strokeStyle = '#d8c7a0';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(8, 12);
    c.lineTo(80, 12);
    c.stroke();
    c.fillStyle = '#e8eef7';
    c.beginPath();
    c.moveTo(94, 12);
    c.lineTo(78, 5);
    c.lineTo(78, 19);
    c.fill();
    c.fillStyle = '#c0392b';
    c.fillRect(4, 6, 12, 4);
    c.fillRect(4, 14, 12, 4);
  });
}

function slashTexture() {
  return canvasTexture(128, 128, (c) => {
    for (let i = 0; i < 12; i++) {
      c.strokeStyle = `rgba(255, 255, 255, ${0.08 + i * 0.07})`;
      c.lineWidth = 2 + i * 0.9;
      c.beginPath();
      c.arc(64, 64, 46 - i * 0.6, -Math.PI * 0.85 + i * 0.07, Math.PI * 0.2);
      c.stroke();
    }
  });
}

function shieldTexture() {
  return canvasTexture(96, 96, (c) => {
    const points = Array.from({ length: 6 }, (_, i) => {
      const angle = Math.PI / 6 + (i * Math.PI) / 3;
      return [48 + Math.cos(angle) * 40, 48 + Math.sin(angle) * 40] as const;
    });
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fillStyle = 'rgba(120, 190, 255, 0.28)';
    c.fill();
    c.shadowColor = '#9fd4ff';
    c.shadowBlur = 8;
    c.strokeStyle = 'rgba(200, 235, 255, 0.95)';
    c.lineWidth = 5;
    c.stroke();
  });
}

function beamTexture() {
  return canvasTexture(16, 128, (c) => {
    const gradient = c.createLinearGradient(0, 128, 0, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gradient;
    c.fillRect(0, 0, 16, 128);
  });
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  await image.decode();
  return image;
}

// ---------------------------------------------------------------------------
// Shared textures, geometry and material helpers

export interface StageAssets {
  readonly glow: THREE.CanvasTexture;
  readonly shadowMap: THREE.CanvasTexture;
  readonly ring: THREE.CanvasTexture;
  readonly strip: THREE.CanvasTexture;
  readonly arrow: THREE.CanvasTexture;
  readonly slash: THREE.CanvasTexture;
  readonly shieldMap: THREE.CanvasTexture;
  readonly beam: THREE.CanvasTexture;
  readonly plane: THREE.PlaneGeometry;
  readonly flatPlane: THREE.PlaneGeometry;
  readonly shock: THREE.RingGeometry;
  readonly column: THREE.CylinderGeometry;
  /** Registers something to dispose with the stage. */
  keep<T extends { dispose(): void }>(item: T): T;
  /** True for anything registered with keep, which transient effects must not dispose. */
  owns(item: unknown): boolean;
  basic(params: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial;
  additive(map: THREE.Texture, color: number, opacity?: number): THREE.MeshBasicMaterial;
  dispose(): void;
}

export function createStageAssets(): StageAssets {
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };
  const basic = (params: THREE.MeshBasicMaterialParameters) =>
    keep(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, ...params }));

  return {
    glow: keep(radial('rgba(255,255,255,1)', 'rgba(255,255,255,0)')),
    shadowMap: keep(radial('rgba(0,0,0,0.62)', 'rgba(0,0,0,0)')),
    ring: keep(ringTexture()),
    strip: keep(stripTexture()),
    arrow: keep(arrowTexture()),
    slash: keep(slashTexture()),
    shieldMap: keep(shieldTexture()),
    beam: keep(beamTexture()),
    plane: keep(new THREE.PlaneGeometry(1, 1)),
    flatPlane: keep(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
    shock: keep(new THREE.RingGeometry(0.82, 1, 56).rotateX(-Math.PI / 2)),
    column: keep(new THREE.CylinderGeometry(0.5, 0.5, 7, 24, 1, true).translate(0, 3.5, 0)),
    keep,
    owns: (item) => disposables.includes(item as { dispose(): void }),
    basic,
    additive: (map, color, opacity = 1) =>
      basic({ map, color, opacity, blending: THREE.AdditiveBlending, fog: false }),
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
}
