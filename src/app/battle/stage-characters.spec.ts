import {
  AnimationClip,
  Bone,
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  NumberKeyframeTrack,
  Object3D,
  Quaternion,
  QuaternionKeyframeTrack,
  Skeleton,
  SkinnedMesh,
  Vector3,
  VectorKeyframeTrack,
} from 'three';
import { describe, expect, it } from 'vitest';
import { ALL_CLASSES } from '../core/models/unit-class.model';
import { type CharacterAssets, createCharacterKit } from './stage-characters';

const classIds = ALL_CLASSES.map((cls) => cls.id);
const CLIPS = [
  'Idle_Loop',
  'Walk_Loop',
  'Sword_Idle',
  'Sword_Attack',
  'Punch_Cross',
  'Pistol_Idle_Loop',
  'Pistol_Shoot',
  'Spell_Simple_Shoot',
  'Bow_Shoot',
  'Hit_Chest',
  'Death01',
];

/** A tiny stand-in for a built model: the same bone names, a team piece and a muzzle. */
function fakeModel(): Object3D {
  const scene = new Group();
  const root = new Bone();
  root.name = 'root';
  const pelvis = new Bone();
  pelvis.name = 'pelvis';
  pelvis.position.y = 1;
  const head = new Bone();
  head.name = 'Head';
  head.position.y = 0.6;
  const hand = new Bone();
  hand.name = 'hand_r';
  hand.position.set(0, 0.3, 0.4);
  root.add(pelvis);
  pelvis.add(head, hand);
  const muzzle = new Object3D();
  muzzle.name = 'Muzzle';
  hand.add(muzzle);
  const body = new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial({ name: 'MI_Body' }));
  body.bind(new Skeleton([root, pelvis, head, hand]));
  const tabard = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: 'Team' }));
  pelvis.add(tabard);
  scene.add(root, body);
  return scene;
}

/** Each clip bends the pelvis by a distinct angle, so tests can tell which one is playing. */
function fakeClip(name: string, index: number): AnimationClip {
  const bend = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), (index + 1) * 0.1);
  const fall = name === 'Death01' ? [1, 0.2] : [1, 1];
  return new AnimationClip(name, 1, [
    new QuaternionKeyframeTrack('pelvis.quaternion', [0, 1], [0, 0, 0, 1, ...bend.toArray()]),
    new VectorKeyframeTrack('pelvis.position', [0, 1], [0, fall[0], 0, 0, fall[1], 0]),
    // Root motion and scale would fight the stage's own placement; they are dropped.
    new VectorKeyframeTrack('root.position', [0, 1], [0, 0, 0, 5, 0, 0]),
    new NumberKeyframeTrack('Head.morphTargetInfluences', [0, 1], [0, 1]),
  ]);
}

function assets(): CharacterAssets {
  return {
    models: new Map(classIds.map((id) => [id, fakeModel()])),
    clips: CLIPS.map(fakeClip),
  };
}

const pelvisOf = (root: Object3D) => root.getObjectByName('pelvis')!;
const teamColor = (root: Object3D) => {
  let color: Color | undefined;
  root.traverse((object) => {
    const material = (object as Mesh).material as MeshStandardMaterial | undefined;
    if (material?.name === 'Team') color = material.color;
  });
  return color!.getHex();
};

describe('stage characters', () => {
  it('clones a model per character, colours its team pieces and mirrors enemies', () => {
    const loaded = assets();
    const kit = createCharacterKit(loaded, false);
    for (const classId of classIds) {
      const player = kit.create(classId, 'player', 0);
      const enemy = kit.create(classId, 'enemy', 0);
      expect(player.root.getObjectByName('pelvis')).not.toBe(enemy.root.getObjectByName('pelvis'));
      expect(teamColor(player.root)).not.toBe(teamColor(enemy.root));
      // Enemies are mirror images so both sides show their weapon side to the camera.
      expect(player.root.scale.x).toBe(1);
      expect(enemy.root.scale.x).toBe(-1);
      player.dispose();
      enemy.dispose();
    }
    // The shared source models are never touched.
    expect(teamColor(loaded.models.get('fighter')!)).toBe(0xffffff);
  });

  it('keeps only rotations and the pelvis height from the clip library', () => {
    const character = createCharacterKit(assets(), false).create('fighter', 'player', 0);
    for (let i = 0; i < 10; i++) character.update(0.05);
    character.root.updateMatrixWorld(true);
    expect(character.root.getObjectByName('root')!.position.x).toBe(0);
    expect(pelvisOf(character.root).quaternion.x).toBeGreaterThan(0);
  });

  it('times an action so its key moment lands on the beat, then returns to the stance', () => {
    const character = createCharacterKit(assets(), false).create('fighter', 'player', 0);
    const pelvis = pelvisOf(character.root);
    const bend = () => 2 * Math.acos(Math.min(1, Math.abs(pelvis.quaternion.w)));
    character.update(0.01);
    // Sword_Attack lands 42% in; contact at 0.21 s plays the one-second clip at double speed.
    character.act('attack', 0.21);
    for (let i = 0; i < 9; i++) character.update(0.05);
    // 0.45 s in: 90% through the attack, whose bend ends at 0.4 rad.
    expect(bend()).toBeGreaterThan(0.3);
    expect(bend()).toBeLessThan(0.42);
    // Once finished it fades back to the looping stance instead of holding the last frame.
    for (let i = 0; i < 6; i++) character.update(0.05);
    expect(bend()).toBeLessThan(0.32);
  });

  it('turns square to the enemy while acting', () => {
    const character = createCharacterKit(assets(), false).create('fighter', 'player', 0);
    const facing = character.root.children[0];
    character.update(0.1);
    const stance = facing.rotation.y;
    character.act('attack', 0.3);
    for (let i = 0; i < 5; i++) character.update(0.05);
    expect(facing.rotation.y).toBeGreaterThan(stance + 0.3);
    for (let i = 0; i < 40; i++) character.update(0.05);
    expect(facing.rotation.y).toBeCloseTo(stance, 2);
  });

  it('reports the muzzle in world space', () => {
    const character = createCharacterKit(assets(), false).create('archer', 'player', 0);
    character.root.position.set(3, 0, 0);
    character.root.updateMatrixWorld(true);
    const muzzle = character.muzzle(new Vector3());
    expect(muzzle.y).toBeCloseTo(1.3, 1);
    expect(muzzle.x).toBeGreaterThan(2.5);
  });

  it('falls and stays down when defeated', () => {
    const character = createCharacterKit(assets(), false).create('fighter', 'player', 0);
    character.die();
    for (let i = 0; i < 30; i++) character.update(0.05);
    // Dead characters ignore further orders.
    character.act('attack', 0.2);
    character.setBase('walk');
    for (let i = 0; i < 30; i++) character.update(0.05);
    expect(pelvisOf(character.root).position.y).toBeCloseTo(0.2, 2);
  });

  it('flashes white on a hit and settles back', () => {
    const character = createCharacterKit(assets(), false).create('cleric', 'player', 0);
    const materials: MeshStandardMaterial[] = [];
    character.root.traverse((object) => {
      if ((object as Mesh).isMesh)
        materials.push((object as Mesh).material as MeshStandardMaterial);
    });
    character.flash(1);
    expect(materials.every((m) => m.emissive.r > 0.3)).toBe(true);
    character.flash(0);
    expect(materials.every((m) => m.emissive.r === 0)).toBe(true);
  });

  it('holds still under reduced motion until something happens', () => {
    const character = createCharacterKit(assets(), true).create('cleric', 'player', 0.5);
    const pose = () => pelvisOf(character.root).quaternion.toArray().join();
    character.update(0.01);
    const before = pose();
    for (let i = 0; i < 20; i++) character.update(0.1);
    expect(pose()).toBe(before);
  });
});
