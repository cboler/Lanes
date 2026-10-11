import * as THREE from 'three';
import {
  createCharacterKit,
  loadCharacterAssets,
  type Character,
  type CharacterKit,
} from './stage-characters';
import type { Effects } from './stage-effects';
import { HEAD_HEIGHT, laneZ, worldX } from './stage-layout';
import type { Particles } from './stage-particles';
import type { StageContext, StageUnit } from './stage-types';

export interface UnitView {
  readonly id: string;
  readonly team: 'player' | 'enemy';
  readonly group: THREE.Group;
  readonly character: Character;
  flash: number;
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
}

export const facing = (team: 'player' | 'enemy') => (team === 'player' ? 1 : -1);

export interface Units {
  readonly views: Map<string, UnitView>;
  readonly kit: CharacterKit;
  create(unit: StageUnit): UnitView;
  remove(view: UnitView): void;
  /** Removes every view; the character kit stays until the caller disposes it. */
  clear(): void;
  update(dt: number): void;
  chest(view: UnitView, out?: THREE.Vector3): THREE.Vector3;
  /** Where the weapon is right now: projectiles and cast sparks start here. */
  hand(view: UnitView): THREE.Vector3;
}

export async function createUnits(
  { scene, assets, random, reducedMotion }: StageContext,
  particles: Particles,
  effects: Effects,
): Promise<Units> {
  const { basic, flatPlane, shadowMap, shieldMap, ring } = assets;
  const views = new Map<string, UnitView>();
  const kit = createCharacterKit(
    await loadCharacterAssets(['fighter', 'cleric', 'archer', 'witch', 'lancer', 'gunner']),
    reducedMotion,
  );

  const create = (unit: StageUnit): UnitView => {
    const character = kit.create(unit.classId, unit.team, random());
    const shadow = new THREE.Mesh(flatPlane, basic({ map: shadowMap }));
    shadow.scale.set(1.5, 1, 0.55);
    shadow.position.y = 0.02;
    shadow.renderOrder = 2;
    const shield = effects.glowSprite(0xffffff, 1.05, shieldMap);
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
    group.add(shadow, buff, character.root, shield);
    const home = new THREE.Vector3(worldX(unit.x), 0, laneZ(unit.lane));
    group.position.copy(home);
    scene.add(group);
    return {
      id: unit.id,
      team: unit.team,
      group,
      character,
      flash: 0,
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
    };
  };

  const remove = (view: UnitView) => {
    scene.remove(view.group);
    view.character.dispose();
    (view.shadow.material as THREE.Material).dispose();
    view.shield.material.dispose();
    (view.buff.material as THREE.Material).dispose();
  };

  const chest: Units['chest'] = (view, out = new THREE.Vector3()) =>
    out.copy(view.group.position).setY(HEAD_HEIGHT * 0.55);
  const hand: Units['hand'] = (view) => view.character.muzzle(new THREE.Vector3());

  const update = (dt: number) => {
    const follow = 1 - Math.exp(-dt * 11);
    for (const view of views.values()) {
      const { group, character } = view;
      group.position.lerp(view.goal, follow);
      const laneTravel = Math.abs(view.goal.z - view.hopFrom);
      const hop =
        laneTravel > 0.01
          ? Math.sin(Math.PI * (1 - Math.abs(view.goal.z - group.position.z) / laneTravel)) * 0.45
          : 0;
      const walking =
        Math.abs(view.goal.x - group.position.x) > 0.03 ||
        Math.abs(view.goal.z - group.position.z) > 0.08;
      if (
        walking ||
        group.position.distanceToSquared(view.goal) > 1e-4 ||
        Math.abs(view.knock) > 0.005 ||
        view.flash > 0 ||
        (view.dying >= 0 && view.dying < 1)
      ) {
        effects.touch();
      }
      view.knock *= Math.exp(-dt * 9);
      view.flash = Math.max(0, view.flash - dt * 6);
      const body = character.root;
      body.position.set(view.offset.x + view.knock, view.offset.y + hop, view.offset.z);
      character.flash(view.flash);
      character.setBase(walking ? 'walk' : view.guard > 0 ? 'guard' : 'idle');
      character.update(dt);
      view.shadow.position.set(body.position.x, 0.02, body.position.z);
      const shieldTarget = view.guard > 0 ? 0.85 : 0;
      view.shield.visible = view.shield.material.opacity > 0.02 || shieldTarget > 0;
      view.shield.material.opacity +=
        (shieldTarget - view.shield.material.opacity) * Math.min(1, dt * 6);
      view.shield.position.x = facing(view.team) * 0.55 + body.position.x;
      if (view.buff.visible) view.buff.rotation.y += dt * 1.5;
      if (view.dying >= 0 && view.dying < 1) {
        // Fall (the death clip), lie a moment, then sink out of sight.
        if (view.dying === 0) character.die();
        view.dying = Math.min(1, view.dying + dt / 1.7);
        const sink = Math.max(0, (view.dying - 0.7) / 0.3);
        body.position.y -= sink * 0.5;
        view.shadow.scale.set(1.5 * (1 - sink), 1, 0.55 * (1 - sink));
        if (view.dying > 0.4 && view.dying < 0.5)
          particles.burst(group.position.clone().setY(0.15), 0x8d8272, 2, 1.2, 0.5);
      }
      group.visible = view.dying < 1;
    }
  };

  return {
    views,
    kit,
    create,
    remove,
    clear: () => {
      for (const view of views.values()) remove(view);
      views.clear();
    },
    update,
    chest,
    hand,
  };
}
