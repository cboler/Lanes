import * as THREE from 'three';
import { seededRandom } from '../core/models/mercenary.model';
import { SPRITE_FEET, SPRITE_VIEWBOX, spriteUrl } from './sprite-art';

/*
 * The 2.5D battle stage: a side view of three lanes receding into depth, painted
 * backdrop, billboard sprites and skill choreography. It only renders state; the
 * rules engine has already resolved everything it shows. Loaded lazily with three.
 */

export const FIELD_WIDTH = 16;
export const LANE_GAP = 3.2;
const SPRITE_HEIGHT = 2.1;
const SPRITE_WIDTH = (SPRITE_HEIGHT * SPRITE_VIEWBOX.width) / SPRITE_VIEWBOX.height;
/** Top of the head (SVG y = 3) above the ground. */
const HEAD_HEIGHT = (SPRITE_FEET - (3 - SPRITE_VIEWBOX.y) / SPRITE_VIEWBOX.height) * SPRITE_HEIGHT;
const PITCH = THREE.MathUtils.degToRad(18);
const FOV = 11;

export const worldX = (positionX: number): number => (positionX - 0.5) * FIELD_WIDTH;
export const laneZ = (lane: number): number => (lane - 1) * LANE_GAP;

export interface StageUnit {
  readonly id: string;
  readonly classId: string;
  readonly team: 'player' | 'enemy';
  readonly lane: number;
  readonly x: number;
  readonly alive: boolean;
  readonly guard: number;
  readonly buffed: boolean;
}

export interface StageState {
  readonly units: readonly StageUnit[];
  readonly activeId: string | null;
  /** Reachable positionX span for the controllable active unit. */
  readonly moveRange: { readonly from: number; readonly to: number } | null;
  readonly targets: readonly { readonly id: string; readonly tone: 'enemy' | 'ally' | 'risk' }[];
  readonly focusedId: string | null;
  /** Lanes covered by the selected area skill. */
  readonly areaLanes: readonly number[];
  /** Animation time scale: 1 at normal speed, smaller when faster. */
  readonly speed: number;
  /** Seconds after an action starts that its hits land (matches the DOM numbers). */
  readonly impactDelay: number;
}

export interface StageAction {
  readonly attackerId: string;
  readonly abilityId: string;
  readonly effects: readonly {
    readonly targetId: string;
    readonly isHealing: boolean;
    readonly guardAbsorbed: number;
    readonly wasDefeated: boolean;
  }[];
}

export interface Stage {
  sync(state: StageState): void;
  play(action: StageAction): void;
  dispose(): void;
}

export interface StageOptions {
  readonly canvas: HTMLCanvasElement;
  /** Holds one element per unit, marked with data-unit-id, laid over its sprite. */
  readonly overlay: HTMLElement;
  readonly reducedMotion: boolean;
  readonly onLost: () => void;
}

export interface Frame {
  readonly target: THREE.Vector3;
  readonly distance: number;
}

/** Reserved screen fractions (0..1) that the framed points must stay out of. */
export interface SafeArea {
  readonly top: number;
  readonly bottom: number;
  readonly side: number;
}

const VIEW_DIRECTION = new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH));
const VIEW_UP = new THREE.Vector3(0, Math.cos(PITCH), -Math.sin(PITCH));

export function placeCamera(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  distance: number,
) {
  camera.position.copy(target).addScaledVector(VIEW_DIRECTION, distance);
  camera.lookAt(target);
  camera.updateMatrixWorld();
}

/**
 * Finds the closest camera, at the fixed side-view pitch, that shows every point
 * inside the safe area, centred in it. Binary search is plenty for a few dozen points.
 */
export function fitFrame(
  camera: THREE.PerspectiveCamera,
  points: readonly THREE.Vector3[],
  safe: SafeArea,
  /** Share of any spare height that goes below the points (0.5 = centred). */
  lowerShare = 0.35,
): Frame {
  const box = new THREE.Box3().setFromPoints([...points]);
  const target = box.getCenter(new THREE.Vector3());
  const limits = { left: -1 + 2 * safe.side, right: 1 - 2 * safe.side };
  const top = 1 - 2 * safe.top;
  const bottom = -1 + 2 * safe.bottom;
  const probe = new THREE.Vector3();
  const bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const measure = (distance: number) => {
    placeCamera(camera, target, distance);
    bounds.minX = bounds.minY = Infinity;
    bounds.maxX = bounds.maxY = -Infinity;
    for (const point of points) {
      probe.copy(point).project(camera);
      bounds.minX = Math.min(bounds.minX, probe.x);
      bounds.maxX = Math.max(bounds.maxX, probe.x);
      bounds.minY = Math.min(bounds.minY, probe.y);
      bounds.maxY = Math.max(bounds.maxY, probe.y);
    }
    return (
      bounds.maxX - bounds.minX <= limits.right - limits.left &&
      bounds.maxY - bounds.minY <= top - bottom
    );
  };

  let distance = 60;
  for (let pass = 0; pass < 3; pass++) {
    let near = 4;
    let far = 400;
    for (let step = 0; step < 28; step++) {
      const mid = (near + far) / 2;
      if (measure(mid)) far = mid;
      else near = mid;
    }
    distance = far;
    measure(distance);
    // Re-centre: shift the look-at point by the projected offset from the safe centre.
    const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfWidth = halfHeight * camera.aspect;
    target.x += ((bounds.minX + bounds.maxX) / 2 - (limits.left + limits.right) / 2) * halfWidth;
    const slack = Math.max(0, top - bottom - (bounds.maxY - bounds.minY));
    const wantedCentre = bottom + (bounds.maxY - bounds.minY) / 2 + slack * lowerShare;
    target.addScaledVector(VIEW_UP, ((bounds.minY + bounds.maxY) / 2 - wantedCentre) * halfHeight);
  }
  return { target, distance };
}

// ---------------------------------------------------------------------------
// Procedural textures (seeded, so the arena looks the same every visit)

function canvasTexture(
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

function groundTexture() {
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

function laneTexture(label: string) {
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

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  await image.decode();
  return image;
}

/** Rasterize a class sprite with an ink outline and soft top-left lighting. */
async function spriteTexture(classId: string, team: 'player' | 'enemy') {
  const width = 304;
  const height = 336;
  const image = await loadImage(spriteUrl(classId, team, width, height));
  const silhouette = document.createElement('canvas');
  silhouette.width = width;
  silhouette.height = height;
  const s = silhouette.getContext('2d')!;
  s.drawImage(image, 0, 0, width, height);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = '#0a0d16';
  s.fillRect(0, 0, width, height);
  return canvasTexture(width, height, (c) => {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      c.drawImage(silhouette, Math.cos(angle) * 4.5, Math.sin(angle) * 4.5);
    }
    c.drawImage(image, 0, 0, width, height);
    c.globalCompositeOperation = 'source-atop';
    const light = c.createLinearGradient(0, 0, width, height);
    light.addColorStop(0, 'rgba(255, 236, 200, 0.18)');
    light.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    light.addColorStop(1, 'rgba(8, 10, 28, 0.32)');
    c.fillStyle = light;
    c.fillRect(0, 0, width, height);
  });
}

// ---------------------------------------------------------------------------
// Skill presentation

type Delivery =
  | 'melee'
  | 'lunge'
  | 'spin'
  | 'shout'
  | 'arrow'
  | 'volley'
  | 'bullet'
  | 'snipe'
  | 'bolt'
  | 'meteor'
  | 'wave'
  | 'pillar'
  | 'blessing'
  | 'buff';

interface SkillLook {
  readonly delivery: Delivery;
  readonly color: number;
  readonly burst?: 'explosion';
}

const LOOKS: Record<string, SkillLook> = {
  shield_bash: { delivery: 'melee', color: 0xdbeafe },
  provoke: { delivery: 'shout', color: 0xff7a45 },
  bulwark: { delivery: 'buff', color: 0xffd36a },
  mend: { delivery: 'pillar', color: 0x7dffb2 },
  holy_smite: { delivery: 'pillar', color: 0xfff1b0 },
  bless: { delivery: 'blessing', color: 0x9dffc4 },
  quick_shot: { delivery: 'arrow', color: 0xfff2c4 },
  piercing_arrow: { delivery: 'arrow', color: 0x8fe8ff },
  volley: { delivery: 'volley', color: 0xfff2c4 },
  fire_bolt: { delivery: 'bolt', color: 0xff8a2b },
  inferno: { delivery: 'wave', color: 0xff6a1f },
  meteor: { delivery: 'meteor', color: 0xff5a1f, burst: 'explosion' },
  thrust: { delivery: 'melee', color: 0xbfe6ff },
  piercing_lunge: { delivery: 'lunge', color: 0x8fd3ff },
  whirlwind: { delivery: 'spin', color: 0xcfe9ff },
  quick_fire: { delivery: 'bullet', color: 0xffd36a },
  snipe: { delivery: 'snipe', color: 0xffe08a },
  explosive_shot: { delivery: 'bullet', color: 0xff9f43, burst: 'explosion' },
};

// ---------------------------------------------------------------------------

interface UnitView {
  readonly id: string;
  readonly team: 'player' | 'enemy';
  readonly group: THREE.Group;
  readonly body: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly flash: { value: number };
  readonly shadow: THREE.Mesh;
  readonly shield: THREE.Sprite;
  readonly buff: THREE.Mesh;
  readonly goal: THREE.Vector3;
  readonly offset: THREE.Vector3;
  hopFrom: number;
  alive: boolean;
  dying: number;
  guard: number;
  knock: number;
  spin: number;
  phase: number;
}

interface Tween {
  readonly start: number;
  readonly duration: number;
  readonly update: (progress: number) => void;
  readonly done?: () => void;
}

const facing = (team: 'player' | 'enemy') => (team === 'player' ? 1 : -1);
const ease = (t: number) => 1 - (1 - t) ** 3;

export async function createStage(options: StageOptions): Promise<Stage> {
  const { canvas, overlay, reducedMotion } = options;
  const context = canvas.getContext('webgl2', { antialias: true });
  if (!context) throw new Error('WebGL2 is unavailable.');
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b2130);
  const fog = new THREE.Fog(0x252b3a, 30, 90);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 200);

  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // Textures and shared geometry --------------------------------------------
  const glow = keep(radial('rgba(255,255,255,1)', 'rgba(255,255,255,0)'));
  const shadowMap = keep(radial('rgba(0,0,0,0.62)', 'rgba(0,0,0,0)'));
  const ring = keep(ringTexture());
  const strip = keep(stripTexture());
  const arrow = keep(arrowTexture());
  const slash = keep(slashTexture());
  const shieldMap = keep(shieldTexture());
  const beam = keep(beamTexture());
  const plane = keep(new THREE.PlaneGeometry(1, 1));
  const flatPlane = keep(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const spritePlane = keep(
    new THREE.PlaneGeometry(SPRITE_WIDTH, SPRITE_HEIGHT).translate(
      0,
      SPRITE_HEIGHT * (SPRITE_FEET - 0.5),
      0,
    ),
  );
  const shock = keep(new THREE.RingGeometry(0.82, 1, 56).rotateX(-Math.PI / 2));
  const column = keep(new THREE.CylinderGeometry(0.5, 0.5, 7, 24, 1, true).translate(0, 3.5, 0));

  const basic = (params: THREE.MeshBasicMaterialParameters) =>
    keep(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, ...params }));
  const additive = (map: THREE.Texture, color: number, opacity = 1) =>
    basic({ map, color, opacity, blending: THREE.AdditiveBlending, fog: false });

  // Environment ---------------------------------------------------------------
  scene.add(new THREE.HemisphereLight(0xaab8e8, 0x3b2a1a, 2.1));
  const sun = new THREE.DirectionalLight(0xffd2a0, 1.7);
  sun.position.set(-8, 14, 12);
  scene.add(sun);

  // The ground ends at a broken wall; the painted backdrop fills the view behind it.
  const BACK_EDGE = laneZ(0) - 3.4;
  const ground = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(90, 26).rotateX(-Math.PI / 2)),
    keep(new THREE.MeshLambertMaterial({ map: keep(groundTexture()) })),
  );
  ground.position.set(0, 0, BACK_EDGE + 13);
  scene.add(ground);

  ['I', 'II', 'III'].forEach((label, lane) => {
    const mesh = new THREE.Mesh(
      flatPlane,
      basic({ map: keep(laneTexture(label)), color: lane === 1 ? 0xfff4dc : 0xe8dcc4 }),
    );
    mesh.scale.set(FIELD_WIDTH + 1.4, 1, LANE_GAP * 0.92);
    mesh.position.set(0, 0.01, laneZ(lane));
    mesh.renderOrder = 1;
    scene.add(mesh);
  });

  // Painted backdrop, drawn in screen space behind everything and aligned each
  // frame so its skyline sits on the wall line. A missing image only costs scenery.
  let backdrop: THREE.Texture | null = null;
  const BACKDROP_HORIZON = 0.6;
  void loadImage('assets/background/arena.jpg')
    .then((image) => {
      backdrop = keep(
        canvasTexture(image.width, image.height, (c) => {
          c.drawImage(image, 0, 0);
          c.fillStyle = 'rgba(22, 27, 42, 0.22)';
          c.fillRect(0, 0, image.width, image.height);
          const haze = c.createLinearGradient(0, 0, 0, image.height);
          haze.addColorStop(BACKDROP_HORIZON - 0.2, 'rgba(37, 43, 58, 0)');
          haze.addColorStop(BACKDROP_HORIZON, 'rgba(37, 43, 58, 0.85)');
          c.fillStyle = haze;
          c.fillRect(0, 0, image.width, image.height);
        }),
      );
      scene.background = backdrop;
    })
    .catch(() => undefined);
  const edge = new THREE.Vector3();
  const alignBackdrop = () => {
    if (!backdrop) return;
    const image = backdrop.image as HTMLCanvasElement;
    const aspect = image.width / image.height;
    edge.set(camera.position.x, 0, BACK_EDGE).project(camera);
    const line = Math.min(height, Math.max(0, (-edge.y * 0.5 + 0.5) * height));
    // Cover the width and everything above the wall line, never distorting the painting.
    const shown = Math.max(width / aspect, line / BACKDROP_HORIZON);
    const top = line - BACKDROP_HORIZON * shown;
    backdrop.repeat.set(width / (shown * aspect), height / shown);
    backdrop.offset.set(
      (shown * aspect - width) / (2 * shown * aspect),
      1 - (height - top) / shown,
    );
  };

  const stone = keep(new THREE.MeshLambertMaterial({ color: 0x4d5354, flatShading: true }));
  const darkStone = keep(new THREE.MeshLambertMaterial({ color: 0x2b3033, flatShading: true }));
  const moss = keep(new THREE.MeshLambertMaterial({ color: 0x3c4a33, flatShading: true }));
  const rock = keep(new THREE.DodecahedronGeometry(1, 0));
  const pillar = keep(new THREE.CylinderGeometry(0.55, 0.65, 1, 7));
  const random = seededRandom(7);
  const prop = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number],
    tilt = 0,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(tilt * 0.3, random() * Math.PI, tilt);
    scene.add(mesh);
  };
  // Haze where the ground meets the painting, low rubble along that edge,
  // rocks at the flanks and foreground.
  const haze = new THREE.Mesh(
    plane,
    basic({
      map: keep(
        canvasTexture(8, 64, (c) => {
          const fade = c.createLinearGradient(0, 0, 0, 64);
          fade.addColorStop(0, 'rgba(255,255,255,0)');
          fade.addColorStop(0.75, 'rgba(255,255,255,0.85)');
          fade.addColorStop(1, 'rgba(255,255,255,1)');
          c.fillStyle = fade;
          c.fillRect(0, 0, 8, 64);
        }),
      ),
      color: 0x2a3040,
      fog: false,
    }),
  );
  haze.scale.set(120, 3.2, 1);
  haze.position.set(0, 1.3, BACK_EDGE);
  scene.add(haze);
  for (let i = 0; i < 36; i++) {
    const size = 0.08 + random() ** 3 * 0.3;
    prop(
      rock,
      random() < 0.3 ? moss : darkStone,
      [(random() - 0.5) * 40, size * 0.2, BACK_EDGE + 0.3 + random() * 1.2],
      [size * 1.6, size, size],
    );
  }
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1;
    const size = 0.3 + random() * 0.8;
    prop(
      rock,
      random() < 0.4 ? moss : darkStone,
      [side * (9.8 + random() * 5), size * 0.3, BACK_EDGE + 1 + random() * 11],
      [size * 1.4, size, size],
    );
  }
  for (const [x, z, size] of [
    [-11.5, 6.8, 1.6],
    [-9.4, 8, 1.1],
    [11.4, 7, 1.8],
    [9.2, 8.2, 0.9],
  ] as const) {
    prop(rock, darkStone, [x, size * 0.25, z], [size * 1.5, size, size]);
  }

  const torches = [-9.3, 9.3].map((x) => {
    prop(pillar, darkStone, [x, 0.45, BACK_EDGE + 0.8], [0.26, 0.9, 0.26]);
    prop(pillar, stone, [x, 0.98, BACK_EDGE + 0.8], [0.62, 0.22, 0.62]);
    const flame = new THREE.Sprite(
      keep(
        new THREE.SpriteMaterial({
          map: glow,
          color: 0xff9a3c,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
    flame.position.set(x, 1.4, BACK_EDGE + 0.8);
    flame.scale.setScalar(0.9);
    const light = new THREE.PointLight(0xff8a3d, 16, 11, 1.6);
    light.position.set(x, 1.8, BACK_EDGE + 1.4);
    scene.add(flame, light);
    return { flame, light, seed: random() * 10 };
  });

  // Markers ------------------------------------------------------------------
  const activeRing = new THREE.Mesh(flatPlane, additive(ring, 0xffcf5a, 0.9));
  activeRing.renderOrder = 2;
  const moveStrip = new THREE.Mesh(
    flatPlane,
    basic({ map: strip, color: 0xffd36a, opacity: 0.32, blending: THREE.AdditiveBlending }),
  );
  moveStrip.renderOrder = 1;
  const areaStrips = [0, 1, 2].map(() => {
    const mesh = new THREE.Mesh(
      flatPlane,
      basic({ map: strip, color: 0xff3b2f, blending: THREE.AdditiveBlending, fog: false }),
    );
    mesh.renderOrder = 2;
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });
  scene.add(activeRing, moveStrip);
  const targetRings: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  const toneColor = { enemy: 0xff5147, ally: 0x5dffa0, risk: 0xffa53d };

  // Particles: one draw call for every spark, ember and puff ----------------
  const MAX_PARTICLES = 700;
  const particleData = {
    position: new Float32Array(MAX_PARTICLES * 3),
    color: new Float32Array(MAX_PARTICLES * 3),
    size: new Float32Array(MAX_PARTICLES),
    alpha: new Float32Array(MAX_PARTICLES),
    velocity: new Float32Array(MAX_PARTICLES * 3),
    life: new Float32Array(MAX_PARTICLES),
    ttl: new Float32Array(MAX_PARTICLES),
    gravity: new Float32Array(MAX_PARTICLES),
    baseSize: new Float32Array(MAX_PARTICLES),
    baseAlpha: new Float32Array(MAX_PARTICLES),
  };
  let particleCount = 0;
  const particleGeometry = keep(new THREE.BufferGeometry());
  const attribute = (array: Float32Array, size: number) =>
    new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage);
  particleGeometry.setAttribute('position', attribute(particleData.position, 3));
  particleGeometry.setAttribute('color', attribute(particleData.color, 3));
  particleGeometry.setAttribute('size', attribute(particleData.size, 1));
  particleGeometry.setAttribute('alpha', attribute(particleData.alpha, 1));
  const particleMaterial = keep(
    new THREE.ShaderMaterial({
      uniforms: { map: { value: glow }, scale: { value: 400 } },
      vertexShader: `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        uniform float scale;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 view = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -view.z;
          gl_Position = projectionMatrix * view;
        }`,
      fragmentShader: `
        uniform sampler2D map;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 texel = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(vColor * texel.rgb, texel.a * vAlpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false;
  particles.renderOrder = 5;
  scene.add(particles);
  const tint = new THREE.Color();
  const spawn = (
    at: THREE.Vector3,
    velocity: THREE.Vector3,
    color: number,
    size: number,
    ttl: number,
    gravity = 0,
    alpha = 1,
  ) => {
    if (particleCount >= MAX_PARTICLES) return;
    const i = particleCount++;
    particleData.position.set([at.x, at.y, at.z], i * 3);
    particleData.velocity.set([velocity.x, velocity.y, velocity.z], i * 3);
    tint.set(color);
    particleData.color.set([tint.r, tint.g, tint.b], i * 3);
    particleData.life[i] = 0;
    particleData.ttl[i] = ttl;
    particleData.gravity[i] = gravity;
    particleData.baseSize[i] = size;
    particleData.baseAlpha[i] = alpha;
  };
  const scratch = new THREE.Vector3();
  const burst = (at: THREE.Vector3, color: number, count: number, speed: number, size = 0.35) => {
    for (let i = 0; i < count; i++) {
      scratch.set(random() - 0.5, random() * 0.9 - 0.2, (random() - 0.5) * 0.6).normalize();
      spawn(
        at,
        scratch.multiplyScalar(speed * (0.35 + random())),
        color,
        size * (0.6 + random()),
        0.35 + random() * 0.4,
        -3,
      );
    }
  };
  const updateParticles = (dt: number) => {
    const d = particleData;
    for (let i = 0; i < particleCount; i++) {
      d.life[i] += dt;
      if (d.life[i] >= d.ttl[i]) {
        // Swap-remove keeps the live particles packed at the front.
        const last = --particleCount;
        for (const [array, width] of [
          [d.position, 3],
          [d.velocity, 3],
          [d.color, 3],
        ] as const) {
          array.copyWithin(i * width, last * width, last * width + width);
        }
        for (const array of [d.life, d.ttl, d.gravity, d.baseSize, d.baseAlpha])
          array[i] = array[last];
        i--;
        continue;
      }
      const k = d.life[i] / d.ttl[i];
      d.velocity[i * 3 + 1] += d.gravity[i] * dt;
      d.position[i * 3] += d.velocity[i * 3] * dt;
      d.position[i * 3 + 1] += d.velocity[i * 3 + 1] * dt;
      d.position[i * 3 + 2] += d.velocity[i * 3 + 2] * dt;
      d.size[i] = d.baseSize[i] * (1 - k * 0.5);
      d.alpha[i] = d.baseAlpha[i] * Math.min(1, (1 - k) * 2.2) * Math.min(1, k * 10 + 0.2);
    }
    particleGeometry.setDrawRange(0, particleCount);
    for (const name of ['position', 'color', 'size', 'alpha']) {
      particleGeometry.getAttribute(name).needsUpdate = true;
    }
  };

  // Effects with their own meshes --------------------------------------------
  const tweens: Tween[] = [];
  const timeline: { at: number; run: () => void }[] = [];
  let now = 0;
  /** Last time anything but ambience moved; idle scenes render at half rate. */
  let lastMotion = 0;
  const later = (delay: number, run: () => void) => timeline.push({ at: now + delay, run });
  const tween = (duration: number, update: (progress: number) => void, done?: () => void) =>
    tweens.push({ start: now, duration: Math.max(0.01, duration), update, done });
  const transient = (
    object: THREE.Object3D,
    duration: number,
    update: (progress: number) => void,
  ) => {
    scene.add(object);
    tween(duration, update, () => {
      scene.remove(object);
      const material = (object as THREE.Mesh).material as THREE.Material;
      if (!disposables.includes(material)) material.dispose();
    });
  };
  const glowSprite = (color: number, scale: number, map: THREE.Texture = glow) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map, color, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    sprite.scale.setScalar(scale);
    sprite.renderOrder = 6;
    return sprite;
  };
  const shockwave = (at: THREE.Vector3, color: number, radius: number, duration: number) => {
    const mesh = new THREE.Mesh(
      shock,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    mesh.position.copy(at).setY(0.03);
    mesh.renderOrder = 3;
    transient(mesh, duration, (k) => {
      mesh.scale.setScalar(0.2 + ease(k) * radius);
      mesh.material.opacity = 1 - k;
    });
  };
  const lightColumn = (at: THREE.Vector3, color: number, duration: number) => {
    const mesh = new THREE.Mesh(
      column,
      new THREE.MeshBasicMaterial({
        map: beam,
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    mesh.position.copy(at).setY(0);
    mesh.renderOrder = 4;
    transient(mesh, duration, (k) => {
      mesh.scale.set(1.3 - k * 0.9, 1, 1.3 - k * 0.9);
      mesh.material.opacity = Math.sin(Math.PI * Math.min(1, k * 1.4)) * 0.9;
    });
  };
  const slashAt = (at: THREE.Vector3, color: number, direction: number) => {
    const sprite = glowSprite(color, 1.6, slash);
    sprite.position.copy(at);
    sprite.material.rotation = direction > 0 ? -0.5 : Math.PI + 0.5;
    transient(sprite, 0.28, (k) => {
      sprite.scale.setScalar(1.1 + k * 1.1);
      sprite.material.opacity = 1 - k * k;
    });
  };
  const projected = new THREE.Vector3();
  const projectile = (
    from: THREE.Vector3,
    to: THREE.Vector3,
    duration: number,
    color: number,
    kind: 'arrow' | 'orb' | 'bullet',
    arc: number,
  ) => {
    const sprite =
      kind === 'arrow'
        ? glowSprite(0xffffff, 1, arrow)
        : glowSprite(color, kind === 'orb' ? 0.9 : 0.35);
    if (kind === 'arrow') {
      sprite.scale.set(1.05, 0.26, 1);
      sprite.material.blending = THREE.NormalBlending;
    }
    const previous = new THREE.Vector3().copy(from);
    const point = (k: number, out: THREE.Vector3) =>
      out
        .lerpVectors(from, to, k)
        .setY(THREE.MathUtils.lerp(from.y, to.y, k) + Math.sin(Math.PI * k) * arc);
    transient(sprite, duration, (k) => {
      previous.copy(sprite.position);
      point(k, sprite.position);
      if (kind === 'arrow' && k > 0) {
        // Rotate in screen space so the arrow points along its flight.
        projected.copy(sprite.position).project(camera);
        const head = projected.clone();
        projected.copy(previous).project(camera);
        sprite.material.rotation = Math.atan2(
          head.y - projected.y,
          (head.x - projected.x) * camera.aspect,
        );
      }
      if (kind !== 'arrow' || k > 0.1) {
        spawn(
          sprite.position,
          scratch.set(0, 0.2, 0),
          kind === 'arrow' ? 0xfff0c8 : color,
          kind === 'orb' ? 0.55 : 0.22,
          0.25,
          0,
          0.7,
        );
      }
    });
  };
  const flashLight = new THREE.PointLight(0xff8a3d, 0, 14, 1.5);
  scene.add(flashLight);
  const explode = (at: THREE.Vector3, color: number, size = 1) => {
    burst(at, color, Math.round(40 * size), 5 * size, 0.55 * size);
    burst(at, 0xfff1c1, Math.round(14 * size), 2.5 * size, 0.4 * size);
    shockwave(at, color, 2.6 * size, 0.45);
    flashLight.position.copy(at).setY(1.2);
    flashLight.color.set(color);
    tween(0.4, (k) => (flashLight.intensity = (1 - k) * 60 * size));
    shake = Math.max(shake, 0.18 * size);
  };

  // Units ----------------------------------------------------------------------
  const views = new Map<string, UnitView>();
  const textures = new Map<string, Promise<THREE.Texture>>();
  const textureFor = (classId: string, team: 'player' | 'enemy') => {
    const key = `${classId}:${team}`;
    let texture = textures.get(key);
    if (!texture) {
      texture = spriteTexture(classId, team).then(keep);
      textures.set(key, texture);
    }
    return texture;
  };

  const createView = (unit: StageUnit): UnitView => {
    const flash = { value: 0 };
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      opacity: 0,
      fog: false,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms['uFlash'] = flash;
      shader.fragmentShader = `uniform float uFlash;\n${shader.fragmentShader}`.replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), uFlash);',
      );
    };
    material.customProgramCacheKey = () => 'lanes-sprite';
    void textureFor(unit.classId, unit.team).then((map) => {
      material.map = map;
      material.opacity = 1;
      material.needsUpdate = true;
    });
    const body = new THREE.Mesh(spritePlane, material);
    body.renderOrder = 4;
    const shadow = new THREE.Mesh(flatPlane, basic({ map: shadowMap }));
    shadow.scale.set(1.5, 1, 0.55);
    shadow.position.y = 0.02;
    shadow.renderOrder = 2;
    const shield = glowSprite(0xffffff, 1.05, shieldMap);
    shield.material.blending = THREE.NormalBlending;
    shield.material.opacity = 0;
    shield.position.set(facing(unit.team) * 0.55, HEAD_HEIGHT * 0.5, 0.2);
    shield.visible = false;
    const buff = new THREE.Mesh(
      flatPlane,
      basic({ map: ring, color: 0xffd36a, blending: THREE.AdditiveBlending }),
    );
    buff.scale.set(1.5, 1, 1.5);
    buff.position.y = 0.04;
    buff.visible = false;
    const group = new THREE.Group();
    group.add(shadow, buff, body, shield);
    const home = new THREE.Vector3(worldX(unit.x), 0, laneZ(unit.lane));
    group.position.copy(home);
    scene.add(group);
    return {
      id: unit.id,
      team: unit.team,
      group,
      body,
      flash,
      shadow,
      shield,
      buff,
      goal: home.clone(),
      offset: new THREE.Vector3(),
      hopFrom: home.z,
      alive: unit.alive,
      dying: unit.alive ? -1 : 1,
      guard: unit.guard,
      knock: 0,
      spin: 0,
      phase: random() * Math.PI * 2,
    };
  };

  const removeView = (view: UnitView) => {
    scene.remove(view.group);
    view.body.material.dispose();
    (view.shadow.material as THREE.Material).dispose();
    view.shield.material.dispose();
    (view.buff.material as THREE.Material).dispose();
  };

  // Camera direction -------------------------------------------------------
  let width = 1;
  let height = 1;
  let safe: SafeArea = { top: 0.12, bottom: 0.12, side: 0.03 };
  let desired: Frame = { target: new THREE.Vector3(0, 0.8, 0), distance: 40 };
  const current = { target: new THREE.Vector3(0, 0.8, 0), distance: 40 };
  let snapCamera = true;
  let punch = 0;
  let shake = 0;
  let state: StageState | null = null;

  let framedFor = '';
  const reframe = (force = false) => {
    if (!state) return;
    // Re-fit only when the framed layout changes meaningfully, not on every walk step.
    const layout = state.units
      .filter((unit) => unit.alive)
      .map((unit) => `${unit.lane}:${Math.round(unit.x * 50)}`)
      .join();
    if (!force && layout === framedFor) return;
    framedFor = layout;
    const points: THREE.Vector3[] = [];
    const reach = (x: number, z: number) => {
      points.push(
        new THREE.Vector3(x - 1.05, 0, z + 0.35),
        new THREE.Vector3(x + 1.05, 0, z + 0.35),
        // Leave room above heads for the name and HP plates.
        new THREE.Vector3(x, HEAD_HEIGHT + 0.75, z),
      );
    };
    // A minimum field keeps the camera from zooming onto a lone survivor.
    reach(-5.5, laneZ(0));
    reach(5.5, laneZ(2));
    for (const unit of state.units) if (unit.alive) reach(worldX(unit.x), laneZ(unit.lane));
    desired = fitFrame(camera, points, safe);
  };

  const readSafeArea = () => {
    const style = getComputedStyle(overlay);
    const px = (name: string, fallback: number) =>
      parseFloat(style.getPropertyValue(name)) || fallback;
    safe = {
      top: Math.min(0.4, px('--stage-safe-top', 56) / height),
      bottom: Math.min(0.4, px('--stage-safe-bottom', 24) / height),
      side: Math.min(0.2, Math.max(16, width * 0.025) / width),
    };
  };

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(bounds.width));
    height = Math.max(1, Math.round(bounds.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    particleMaterial.uniforms['scale'].value =
      (height * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    readSafeArea();
    reframe(true);
    snapCamera = true;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  // Choreography -----------------------------------------------------------
  const chest = (view: UnitView, out = new THREE.Vector3()) =>
    out.copy(view.group.position).setY(HEAD_HEIGHT * 0.55);
  const hand = (view: UnitView) =>
    chest(view).add(new THREE.Vector3(facing(view.team) * 0.6, 0.12, 0.05));

  const hit = (
    attacker: UnitView,
    target: UnitView,
    effect: StageAction['effects'][number],
    look: SkillLook,
    scale: number,
  ) => {
    const at = chest(target);
    if (effect.isHealing) {
      for (let i = 0; i < 18; i++) {
        spawn(
          scratch.set(at.x + (random() - 0.5) * 1.1, random() * 0.6, at.z + (random() - 0.5) * 0.4),
          new THREE.Vector3(0, 1.2 + random() * 1.2, 0),
          look.color,
          0.3 + random() * 0.25,
          0.8 + random() * 0.5,
        );
      }
      shockwave(target.group.position, look.color, 1.4, 0.6 * scale);
      return;
    }
    target.flash.value = 0.7;
    const away =
      Math.sign(target.group.position.x - attacker.group.position.x) || -facing(target.team);
    target.knock = away * (effect.wasDefeated ? 0.55 : 0.28);
    burst(at, look.color, 16, 3.2);
    if (effect.guardAbsorbed > 0) {
      target.shield.visible = true;
      target.shield.material.opacity = 1;
      burst(target.shield.getWorldPosition(new THREE.Vector3()), 0x9fd4ff, 12, 2.4, 0.3);
    }
    if (look.burst === 'explosion') explode(at, look.color, 0.7);
    shake = Math.max(shake, 0.06);
    if (effect.wasDefeated) later(0.25 * scale, () => (target.dying = 0));
  };

  const play = (action: StageAction) => {
    const attacker = views.get(action.attackerId);
    if (!attacker || !state) return;
    const look = LOOKS[action.abilityId] ?? { delivery: 'melee', color: 0xffffff };
    const scale = state.speed;
    const impact = state.impactDelay;
    const targets = action.effects
      .map((effect) => ({ effect, view: views.get(effect.targetId) }))
      .filter(
        (entry): entry is { effect: StageAction['effects'][number]; view: UnitView } =>
          !!entry.view,
      );
    const first = targets[0]?.view;
    const dir = facing(attacker.team);
    const origin = attacker.group.position.clone();
    const land = () =>
      targets.forEach(({ effect, view }) => hit(attacker, view, effect, look, scale));

    if (first && !reducedMotion) {
      tween(impact + 0.35 * scale, (k) => (punch = Math.max(punch, Math.sin(Math.PI * k) * 0.025)));
    }

    switch (look.delivery) {
      case 'melee':
      case 'lunge': {
        if (!first) break;
        const goal = first.group.position.clone();
        goal.x -= Math.sign(goal.x - origin.x || dir) * 1.05;
        if (look.delivery === 'melee') goal.z = origin.z;
        const reach = goal.sub(origin);
        tween(impact, (k) => attacker.offset.copy(reach).multiplyScalar(ease(k)));
        later(impact, () => {
          slashAt(chest(first), look.color, dir);
          land();
          tween(0.3 * scale, (k) => attacker.offset.copy(reach).multiplyScalar(1 - ease(k)));
        });
        if (look.delivery === 'lunge')
          later(0.05 * scale, () => burst(chest(attacker), look.color, 10, 1.5, 0.25));
        break;
      }
      case 'spin':
      case 'shout':
        attacker.spin = look.delivery === 'spin' ? impact + 0.1 : 0;
        later(impact * 0.5, () => {
          shockwave(origin, look.color, FIELD_WIDTH * 0.55, 0.55 * scale);
          if (look.delivery === 'shout') burst(chest(attacker), look.color, 18, 2, 0.35);
        });
        later(impact, land);
        break;
      case 'arrow':
      case 'bullet':
      case 'snipe':
      case 'bolt':
        attacker.knock = -dir * 0.12;
        burst(hand(attacker), look.color, look.delivery === 'bolt' ? 12 : 6, 1.4, 0.3);
        for (const { view } of targets.slice(0, look.burst ? 1 : targets.length)) {
          const flight = look.delivery === 'snipe' ? 0.08 : impact - 0.06 * scale;
          later(impact - flight, () =>
            projectile(
              hand(attacker),
              chest(view),
              flight,
              look.color,
              look.delivery === 'arrow' ? 'arrow' : look.delivery === 'bolt' ? 'orb' : 'bullet',
              look.delivery === 'arrow' ? 0.9 : look.delivery === 'bolt' ? 0.35 : 0,
            ),
          );
        }
        later(impact, land);
        break;
      case 'volley':
        attacker.knock = -dir * 0.1;
        for (const { view } of targets) {
          for (let i = 0; i < 5; i++) {
            const to = chest(view).add(
              new THREE.Vector3((random() - 0.5) * 1.2, -0.3, (random() - 0.5) * 0.5),
            );
            const from = to.clone().add(new THREE.Vector3(-dir * 3.2, 6, 0));
            later(impact * 0.25 + i * 0.03, () =>
              projectile(from, to, impact * 0.75 - 0.12, 0xffffff, 'arrow', 0),
            );
          }
        }
        later(impact, land);
        break;
      case 'wave': {
        const distance = first ? first.group.position.x - origin.x : dir * 6;
        for (let i = 1; i <= 7; i++) {
          later((impact * i) / 8, () =>
            burst(
              origin.clone().add(new THREE.Vector3((distance * i) / 7, 0.4, 0)),
              look.color,
              8,
              2.2,
              0.55,
            ),
          );
        }
        later(impact, () => {
          targets.forEach(({ view }) => explode(chest(view), look.color, 0.45));
          land();
        });
        break;
      }
      case 'meteor': {
        const centre = new THREE.Vector3();
        targets.forEach(({ view }) => centre.add(view.group.position));
        if (targets.length) centre.divideScalar(targets.length);
        const rock = glowSprite(look.color, 2.2);
        const from = centre.clone().add(new THREE.Vector3(-dir * 7, 14, -4));
        transient(rock, impact, (k) => {
          rock.position.lerpVectors(from, centre, k * k);
          spawn(rock.position, scratch.set(0, 0.5, 0), 0xffb347, 0.9, 0.4, 0, 0.8);
        });
        later(impact, () => {
          explode(centre, look.color, 1.8);
          land();
        });
        break;
      }
      case 'pillar':
        burst(hand(attacker), look.color, 10, 1.2, 0.3);
        for (const { view } of targets)
          later(impact * 0.4, () => lightColumn(view.group.position, look.color, 0.75 * scale));
        later(impact, land);
        break;
      case 'blessing':
        burst(chest(attacker), look.color, 20, 1.8, 0.35);
        later(impact, land);
        break;
      case 'buff':
        later(impact * 0.5, () => {
          lightColumn(origin, look.color, 0.6 * scale);
          shockwave(origin, look.color, 1.6, 0.5 * scale);
        });
        break;
    }
  };

  // State sync -------------------------------------------------------------
  const sync = (next: StageState) => {
    lastMotion = now;
    const previousActive = state?.activeId;
    state = next;
    const seen = new Set<string>();
    for (const unit of next.units) {
      seen.add(unit.id);
      let view = views.get(unit.id);
      if (!view) {
        view = createView(unit);
        views.set(unit.id, view);
      }
      const goalX = worldX(unit.x);
      const goalZ = laneZ(unit.lane);
      if (goalZ !== view.goal.z) view.hopFrom = view.group.position.z;
      view.goal.set(goalX, 0, goalZ);
      if (!unit.alive && view.alive && view.dying < 0) {
        const dying = view;
        later(next.impactDelay + 0.3, () => {
          if (dying.dying < 0) dying.dying = 0;
        });
      }
      if (unit.alive && !view.alive) view.dying = -1;
      view.alive = unit.alive;
      if (unit.guard > 0 && view.guard === 0 && unit.alive) {
        burst(chest(view), 0x9fd4ff, 14, 1.6, 0.3);
      }
      view.guard = unit.guard;
      view.buff.visible = unit.buffed && unit.alive;
    }
    for (const [id, view] of views) {
      if (!seen.has(id)) {
        removeView(view);
        views.delete(id);
      }
    }
    if (next.activeId !== previousActive && next.activeId) {
      const active = views.get(next.activeId);
      if (active) shockwave(active.goal, 0xffcf5a, 1.2, 0.45);
    }
    reframe();
  };

  // Frame loop -------------------------------------------------------------
  const probe = new THREE.Vector3();
  const written = new WeakMap<HTMLElement, string>();
  const placeOverlay = () => {
    for (const node of overlay.querySelectorAll<HTMLElement>('[data-unit-id]')) {
      const view = views.get(node.dataset['unitId'] ?? '');
      if (!view) continue;
      const base = view.group.position;
      probe.set(base.x, 0, base.z).project(camera);
      const feetX = (probe.x * 0.5 + 0.5) * width;
      const feetY = (-probe.y * 0.5 + 0.5) * height;
      probe.set(base.x, HEAD_HEIGHT, base.z).project(camera);
      const headY = (-probe.y * 0.5 + 0.5) * height;
      const boxHeight = Math.max(24, feetY - headY);
      const boxWidth = Math.max(44, boxHeight * 0.62);
      const style = `${Math.round(feetX - boxWidth / 2)},${Math.round(headY)},${Math.round(boxWidth)},${Math.round(boxHeight)}`;
      if (written.get(node) === style) continue;
      written.set(node, style);
      node.style.transform = `translate3d(${Math.round(feetX - boxWidth / 2)}px, ${Math.round(headY)}px, 0)`;
      node.style.width = `${Math.round(boxWidth)}px`;
      node.style.height = `${Math.round(boxHeight)}px`;
    }
  };

  const updateUnits = (dt: number, time: number) => {
    const follow = 1 - Math.exp(-dt * 11);
    for (const view of views.values()) {
      const { group, body } = view;
      const fromX = group.position.x;
      group.position.lerp(view.goal, follow);
      const laneTravel = Math.abs(view.goal.z - view.hopFrom);
      const hop =
        laneTravel > 0.01
          ? Math.sin(Math.PI * (1 - Math.abs(view.goal.z - group.position.z) / laneTravel)) * 0.45
          : 0;
      const walking = Math.abs(group.position.x - fromX) > 0.0005;
      if (
        walking ||
        group.position.distanceToSquared(view.goal) > 1e-4 ||
        Math.abs(view.knock) > 0.005 ||
        view.flash.value > 0 ||
        view.spin > 0 ||
        (view.dying >= 0 && view.dying < 1)
      ) {
        lastMotion = now;
      }
      view.knock *= Math.exp(-dt * 9);
      view.flash.value = Math.max(0, view.flash.value - dt * 6);
      body.position.set(
        view.offset.x + view.knock,
        view.offset.y +
          hop +
          (walking && !reducedMotion ? Math.abs(Math.sin(time * 16)) * 0.08 : 0),
        view.offset.z,
      );
      const breathe = reducedMotion ? 0 : Math.sin(time * 2.4 + view.phase);
      body.scale.set(1 - breathe * 0.008, 1 + breathe * 0.016, 1);
      if (view.spin > 0) {
        view.spin -= dt;
        body.scale.x = Math.cos(view.spin * 28);
      }
      view.shadow.position.set(body.position.x, 0.02, body.position.z);
      const shieldTarget = view.guard > 0 ? 0.85 : 0;
      view.shield.visible = view.shield.material.opacity > 0.02 || shieldTarget > 0;
      view.shield.material.opacity +=
        (shieldTarget - view.shield.material.opacity) * Math.min(1, dt * 6);
      view.shield.position.x = facing(view.team) * 0.55 + body.position.x;
      if (view.buff.visible) view.buff.rotation.y += dt * 1.5;
      if (view.dying >= 0 && view.dying < 1) {
        view.dying = Math.min(1, view.dying + dt * 1.5);
        const k = ease(view.dying);
        body.rotation.z = facing(view.team) * k * 1.25;
        body.material.opacity = 1 - k;
        view.shadow.scale.set(1.5 * (1 - k), 1, 0.55 * (1 - k));
        if (view.dying < 0.2) burst(group.position.clone().setY(0.2), 0x8d8272, 2, 1.2, 0.5);
      } else if (view.dying < 0 && body.material.map) {
        body.rotation.z = 0;
        body.material.opacity = 1;
        view.shadow.scale.set(1.5, 1, 0.55);
      }
      group.visible = view.dying < 1;
    }
  };

  const updateMarkers = (time: number) => {
    const active = state?.activeId ? views.get(state.activeId) : undefined;
    activeRing.visible = !!active && active.alive;
    if (active) {
      activeRing.position.set(active.group.position.x, 0.03, active.group.position.z);
      const pulse = reducedMotion ? 1 : 1 + Math.sin(time * 4) * 0.06;
      activeRing.scale.set(1.9 * pulse, 1, 1.05 * pulse);
    }
    const range = state?.moveRange;
    moveStrip.visible = !!range && !!active;
    if (range && active) {
      const from = worldX(range.from);
      const to = worldX(range.to);
      moveStrip.position.set((from + to) / 2, 0.02, active.goal.z);
      moveStrip.scale.set(Math.max(0.3, to - from + 1.2), 1, LANE_GAP * 0.62);
    }
    areaStrips.forEach((mesh, lane) => {
      mesh.visible = !!state?.areaLanes.includes(lane);
      mesh.position.set(0, 0.025, laneZ(lane));
      mesh.scale.set(FIELD_WIDTH + 0.6, 1, LANE_GAP * 0.8);
      mesh.material.opacity = 0.42 + (reducedMotion ? 0 : Math.sin(time * 5) * 0.12);
    });
    const targets = state?.targets ?? [];
    while (targetRings.length < targets.length) {
      const mesh = new THREE.Mesh(
        flatPlane,
        basic({ map: ring, blending: THREE.AdditiveBlending }),
      );
      mesh.renderOrder = 3;
      scene.add(mesh);
      targetRings.push(mesh);
    }
    targetRings.forEach((mesh, index) => {
      const target = targets[index];
      const view = target && views.get(target.id);
      mesh.visible = !!view && view.alive;
      if (!view || !target) return;
      const focused = target.id === state?.focusedId;
      const pulse = reducedMotion ? 1 : 1 + Math.sin(time * 6 + index) * 0.07;
      mesh.material.color.set(toneColor[target.tone]);
      mesh.material.opacity = focused ? 1 : 0.55;
      mesh.position.set(view.group.position.x, 0.035, view.group.position.z);
      mesh.scale.set((focused ? 2.1 : 1.7) * pulse, 1, (focused ? 1.15 : 0.95) * pulse);
    });
  };

  const updateCamera = (dt: number) => {
    if (
      current.target.distanceToSquared(desired.target) > 1e-4 ||
      Math.abs(current.distance - desired.distance) > 0.01
    ) {
      lastMotion = now;
    }
    const k = snapCamera ? 1 : 1 - Math.exp(-dt * (reducedMotion ? 30 : 3.2));
    snapCamera = false;
    current.target.lerp(desired.target, k);
    current.distance += (desired.distance - current.distance) * k;
    const target = current.target.clone();
    let distance = current.distance;
    distance *= 1 - punch;
    punch = 0;
    placeCamera(camera, target, distance);
    fog.near = distance + 4;
    fog.far = distance + 60;
    if (shake > 0.001 && !reducedMotion) {
      camera.position.x += (random() - 0.5) * shake;
      camera.position.y += (random() - 0.5) * shake;
      shake *= Math.exp(-dt * 12);
    }
    camera.updateMatrixWorld();
  };

  let frame = 0;
  let last = performance.now();
  let skipFrame = false;
  let emberClock = 0;
  let lost = false;
  const loop = (time: number) => {
    frame = requestAnimationFrame(loop);
    const idle = !tweens.length && !timeline.length && now - lastMotion > 0.6;
    skipFrame = idle && !skipFrame;
    if (skipFrame) return;
    const dt = Math.min(0.05, Math.max(0, (time - last) / 1000));
    last = time;
    now += dt;
    try {
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (timeline[i].at <= now) timeline.splice(i, 1)[0].run();
      }
      for (let i = tweens.length - 1; i >= 0; i--) {
        const item = tweens[i];
        const progress = Math.min(1, (now - item.start) / item.duration);
        item.update(progress);
        if (progress >= 1) {
          tweens.splice(i, 1);
          item.done?.();
        }
      }
      if (!reducedMotion) {
        emberClock += dt;
        while (emberClock > 0.12) {
          emberClock -= 0.12;
          spawn(
            scratch.set((random() - 0.5) * 26, random() * 0.5, -6 + random() * 9),
            new THREE.Vector3((random() - 0.3) * 0.3, 0.35 + random() * 0.4, 0),
            random() < 0.7 ? 0xff9a4a : 0xffd08a,
            0.12 + random() * 0.1,
            3 + random() * 3,
            0,
            0.55,
          );
        }
        for (const torch of torches) {
          const flicker =
            Math.sin(now * 13 + torch.seed) * 0.5 + Math.sin(now * 7.3 + torch.seed * 2) * 0.5;
          torch.light.intensity = 14 + flicker * 4;
          torch.flame.scale.setScalar(0.85 + flicker * 0.1);
        }
      }
      updateUnits(dt, now);
      updateMarkers(now);
      updateParticles(dt);
      updateCamera(dt);
      alignBackdrop();
      renderer.render(scene, camera);
      placeOverlay();
    } catch {
      fail();
    }
  };

  const onContextLost = (event: Event) => {
    event.preventDefault();
    fail();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  const dispose = () => {
    if (lost) return;
    lost = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    canvas.removeEventListener('webglcontextlost', onContextLost);
    for (const node of overlay.querySelectorAll<HTMLElement>('[data-unit-id]')) {
      node.style.removeProperty('transform');
      node.style.removeProperty('width');
      node.style.removeProperty('height');
    }
    for (const view of views.values()) removeView(view);
    views.clear();
    for (const item of disposables) item.dispose();
    for (const mesh of targetRings) mesh.material.dispose();
    renderer.dispose();
    // Browsers cap live WebGL contexts; free this one now rather than at GC.
    renderer.forceContextLoss();
  };
  const fail = () => {
    if (lost) return;
    dispose();
    options.onLost();
  };

  // Everything visible on the first frame should already be decoded.
  await Promise.all(
    ['fighter', 'cleric', 'archer', 'witch', 'lancer', 'gunner'].flatMap((id) => [
      textureFor(id, 'player'),
      textureFor(id, 'enemy'),
    ]),
  );
  resize();
  frame = requestAnimationFrame(loop);

  return { sync, play, dispose };
}
