import * as THREE from 'three';
import { canvasTexture, groundTexture, laneTexture, loadImage } from './stage-assets';
import { FIELD_WIDTH, LANE_GAP, laneZ } from './stage-layout';
import type { Particles } from './stage-particles';
import type { StageContext } from './stage-types';

export interface Environment {
  /** Slides the painted backdrop so its skyline sits on the wall line. */
  alignBackdrop(width: number, height: number): void;
  /** Drifting embers and flickering torches; skipped under reduced motion. */
  ambience(dt: number, now: number): void;
}

export function createEnvironment(
  { scene, camera, assets, random, reducedMotion }: StageContext,
  particles: Particles,
): Environment {
  const { keep, basic, flatPlane, plane, glow } = assets;

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
  const alignBackdrop = (width: number, height: number) => {
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

  const scratch = new THREE.Vector3();
  let emberClock = 0;
  const ambience = (dt: number, now: number) => {
    if (reducedMotion) return;
    emberClock += dt;
    while (emberClock > 0.12) {
      emberClock -= 0.12;
      particles.spawn(
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
  };

  return { alignBackdrop, ambience };
}
