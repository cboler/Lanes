import * as THREE from 'three';
import type { Character } from './stage-characters';
import type { Effects } from './stage-effects';
import { laneZ, worldX } from './stage-layout';
import type { Particles } from './stage-particles';
import type { StageContext, StageState } from './stage-types';

/*
 * Battlefield objects on the stage: a barricade stands in for a character (it has HP and
 * can be targeted, so it is a unit view), and traps are ground markers that burst when
 * they spring.
 */

/**
 * A cheval-de-frise: a log across the lane with crossed, sharpened stakes, built from a
 * few primitives so it needs no model. It answers the Character calls a unit view makes;
 * most are no-ops, a hit flashes it and death topples it.
 */
export function createBarricade(): Character {
  const root = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 });
  const bark = new THREE.MeshStandardMaterial({ color: 0x4a2f14, roughness: 1 });
  const geometries: THREE.BufferGeometry[] = [];
  const keep = <T extends THREE.BufferGeometry>(g: T) => (geometries.push(g), g);

  const log = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.16, 0.16, 2.2, 8)), bark);
  log.rotation.x = Math.PI / 2;
  log.position.y = 0.55;
  root.add(log);
  const stake = keep(new THREE.CylinderGeometry(0.07, 0.09, 1.7, 6));
  const tip = keep(new THREE.ConeGeometry(0.09, 0.3, 6));
  for (let i = 0; i < 4; i++) {
    const z = -0.75 + i * 0.5;
    for (const lean of [-1, 1]) {
      const pair = new THREE.Group();
      const shaft = new THREE.Mesh(stake, wood);
      const point = new THREE.Mesh(tip, wood);
      point.position.y = 1;
      pair.add(shaft, point);
      pair.position.set(0, 0.55, z + lean * 0.08);
      pair.rotation.z = lean * 0.75;
      root.add(pair);
    }
  }

  let falling = -1;
  return {
    root,
    setBase: () => undefined,
    act: () => undefined,
    spin: () => undefined,
    die: () => {
      falling = 0;
    },
    flash: (amount) => {
      wood.emissive.setScalar(amount * 0.6);
      bark.emissive.setScalar(amount * 0.6);
    },
    muzzle: (out) => root.getWorldPosition(out).setY(0.8),
    update: (dt) => {
      if (falling < 0 || falling >= 1) return;
      // Broken: it topples over and settles.
      falling = Math.min(1, falling + dt / 0.6);
      root.rotation.x = -falling * 1.3;
    },
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      wood.dispose();
      bark.dispose();
    },
  };
}

export interface TrapField {
  /** Shows the traps; one that vanished with a unit on it was sprung, and bursts. */
  sync(traps: StageState['traps'], units: StageState['units']): void;
  update(time: number): void;
  dispose(): void;
}

/** Rings with spikes (or a coiled rope for a snare) where traps wait; they burst when sprung. */
export function createTrapField(
  { scene, assets, reducedMotion }: StageContext,
  particles: Particles,
  effects: Effects,
): TrapField {
  const { ring, flatPlane } = assets;
  const spike = new THREE.ConeGeometry(0.08, 0.32, 5);
  const coil = new THREE.TorusGeometry(0.32, 0.05, 6, 16);
  const iron = new THREE.MeshStandardMaterial({ color: 0x8b8f99, metalness: 0.6, roughness: 0.4 });
  const rope = new THREE.MeshStandardMaterial({ color: 0xb08850, roughness: 1 });
  const shown = new Map<string, { group: THREE.Group; glow: THREE.MeshBasicMaterial }>();

  const build = (trap: StageState['traps'][number]) => {
    const group = new THREE.Group();
    const glow = new THREE.MeshBasicMaterial({
      map: ring,
      // The enemy's traps glow red; the player's own glow blue.
      color: trap.team === 'player' ? 0x5aa9ff : 0xff5a3c,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const marker = new THREE.Mesh(flatPlane, glow);
    marker.scale.set(1.2, 1, 0.8);
    marker.position.y = 0.03;
    marker.renderOrder = 2;
    group.add(marker);
    if (trap.kind === 'snare') {
      const loop = new THREE.Mesh(coil, rope);
      loop.rotation.x = Math.PI / 2;
      loop.position.y = 0.05;
      group.add(loop);
    } else {
      for (let i = 0; i < 5; i++) {
        const point = new THREE.Mesh(spike, iron);
        const angle = (i / 5) * Math.PI * 2;
        point.position.set(Math.cos(angle) * 0.25, 0.16, Math.sin(angle) * 0.15);
        group.add(point);
      }
    }
    group.position.set(worldX(trap.x), 0, laneZ(trap.lane));
    scene.add(group);
    return { group, glow };
  };

  const remove = (id: string, burst: boolean) => {
    const entry = shown.get(id);
    if (!entry) return;
    if (burst) {
      const at = entry.group.position.clone().setY(0.4);
      effects.explode(at, 0xff7a45, 0.6);
      particles.burst(at, 0xffb347, 14, 2.2, 0.3);
    }
    scene.remove(entry.group);
    entry.glow.dispose();
    shown.delete(id);
  };

  return {
    sync: (traps, units) => {
      const live = new Set(traps.map((trap) => trap.id));
      for (const [id, entry] of [...shown.entries()]) {
        if (live.has(id)) continue;
        // Sprung if someone stands on it; otherwise the battle simply ended or restarted.
        const at = entry.group.position;
        const sprung = units.some(
          (unit) =>
            Math.abs(worldX(unit.x) - at.x) < 1.2 && Math.abs(laneZ(unit.lane) - at.z) < 0.5,
        );
        remove(id, sprung);
      }
      for (const trap of traps) if (!shown.has(trap.id)) shown.set(trap.id, build(trap));
    },
    update: (time) => {
      const pulse = reducedMotion ? 0.7 : 0.55 + Math.sin(time * 3) * 0.2;
      for (const { glow } of shown.values()) glow.opacity = pulse;
    },
    dispose: () => {
      for (const id of [...shown.keys()]) remove(id, false);
      spike.dispose();
      coil.dispose();
      iron.dispose();
      rope.dispose();
    },
  };
}
