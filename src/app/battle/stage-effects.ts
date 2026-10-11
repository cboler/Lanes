import * as THREE from 'three';
import { Easing, Group, Tween } from 'three/examples/jsm/libs/tween.module.js';
import type { CameraDirector } from './stage-camera';
import type { Particles } from './stage-particles';
import type { StageContext } from './stage-types';

export const ease = Easing.Cubic.Out;

export type ProjectileKind = 'arrow' | 'orb' | 'bullet';

export interface Effects {
  /** Animation time in seconds; advances only while the stage is drawing frames. */
  readonly now: number;
  /** Runs `run` after `delay` seconds of animation time. */
  later(delay: number, run: () => void): void;
  /** Calls `update` with progress 0..1 over `duration`, then `done`. */
  tween(duration: number, update: (progress: number) => void, done?: () => void): void;
  /** Adds an object for `duration` seconds, then removes it and frees its material. */
  transient(object: THREE.Object3D, duration: number, update: (progress: number) => void): void;
  glowSprite(color: number, scale: number, map?: THREE.Texture): THREE.Sprite;
  shockwave(at: THREE.Vector3, color: number, radius: number, duration: number): void;
  lightColumn(at: THREE.Vector3, color: number, duration: number): void;
  slashAt(at: THREE.Vector3, color: number, direction: number): void;
  projectile(
    from: THREE.Vector3,
    to: THREE.Vector3,
    duration: number,
    color: number,
    kind: ProjectileKind,
    arc: number,
  ): void;
  explode(at: THREE.Vector3, color: number, size?: number): void;
  /** Marks the scene as moving, so the idle throttle keeps full frame rate. */
  touch(): void;
  /** True when nothing but ambience has moved for a while; idle scenes render at half rate. */
  idle(): boolean;
  /** Moves animation time forward and runs whatever came due. */
  advance(dt: number): void;
}

export function createEffects(
  { scene, camera, assets }: StageContext,
  particles: Particles,
  director: CameraDirector,
): Effects {
  const { glow, slash, arrow, beam, shock, column } = assets;
  // One tween.js group runs everything, on this stage's own clock rather than wall time.
  const group = new Group();
  let now = 0;
  /** Last time anything but ambience moved. */
  let lastMotion = 0;
  const scratch = new THREE.Vector3();
  const projected = new THREE.Vector3();

  const later: Effects['later'] = (delay, run) => {
    new Tween({}, group)
      .to({}, 0)
      .delay(delay * 1000)
      .onComplete(run)
      .start(now * 1000);
  };
  const tween: Effects['tween'] = (duration, update, done) => {
    const progress = { k: 0 };
    const item = new Tween(progress, group)
      .to({ k: 1 }, Math.max(0.01, duration) * 1000)
      .onUpdate(() => update(progress.k));
    if (done) item.onComplete(done);
    item.start(now * 1000);
  };
  const transient: Effects['transient'] = (object, duration, update) => {
    scene.add(object);
    tween(duration, update, () => {
      scene.remove(object);
      const material = (object as THREE.Mesh).material as THREE.Material;
      if (!assets.owns(material)) material.dispose();
    });
  };
  const glowSprite: Effects['glowSprite'] = (color, scale, map = glow) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map, color, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    sprite.scale.setScalar(scale);
    sprite.renderOrder = 6;
    return sprite;
  };
  const shockwave: Effects['shockwave'] = (at, color, radius, duration) => {
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
  const lightColumn: Effects['lightColumn'] = (at, color, duration) => {
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
  const slashAt: Effects['slashAt'] = (at, color, direction) => {
    const sprite = glowSprite(color, 1.6, slash);
    sprite.position.copy(at);
    sprite.material.rotation = direction > 0 ? -0.5 : Math.PI + 0.5;
    transient(sprite, 0.28, (k) => {
      sprite.scale.setScalar(1.1 + k * 1.1);
      sprite.material.opacity = 1 - k * k;
    });
  };
  const projectile: Effects['projectile'] = (from, to, duration, color, kind, arc) => {
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
        particles.spawn(
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
  const explode: Effects['explode'] = (at, color, size = 1) => {
    particles.burst(at, color, Math.round(40 * size), 5 * size, 0.55 * size);
    particles.burst(at, 0xfff1c1, Math.round(14 * size), 2.5 * size, 0.4 * size);
    shockwave(at, color, 2.6 * size, 0.45);
    flashLight.position.copy(at).setY(1.2);
    flashLight.color.set(color);
    tween(0.4, (k) => (flashLight.intensity = (1 - k) * 60 * size));
    director.addShake(0.18 * size);
  };

  return {
    get now() {
      return now;
    },
    later,
    tween,
    transient,
    glowSprite,
    shockwave,
    lightColumn,
    slashAt,
    projectile,
    explode,
    touch: () => (lastMotion = now),
    idle: () => !group.getAll().length && now - lastMotion > 0.6,
    advance: (dt) => {
      now += dt;
      group.update(now * 1000);
    },
  };
}
