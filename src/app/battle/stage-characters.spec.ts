import { Bone, SkinnedMesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ALL_CLASSES } from '../core/models/unit-class.model';
import { CHARACTER_HEIGHT, createCharacterKit } from './stage-characters';

const classIds = ALL_CLASSES.map((cls) => cls.id);

describe('stage characters', () => {
  it('builds a skinned, outlined character for every class on both teams', () => {
    const kit = createCharacterKit(false);
    for (const classId of classIds) {
      for (const team of ['player', 'enemy'] as const) {
        const character = kit.create(classId, team, 0);
        const meshes: SkinnedMesh[] = [];
        character.root.traverse((object) => {
          if (object instanceof SkinnedMesh) meshes.push(object);
        });
        // The painted body and its ink-outline hull share one skeleton.
        expect(meshes).toHaveLength(2);
        expect(meshes[0].skeleton).toBe(meshes[1].skeleton);
        const bones = meshes[0].skeleton.bones.length;
        const skin = meshes[0].geometry.getAttribute('skinIndex');
        expect(skin.count).toBeGreaterThan(500);
        for (let i = 0; i < skin.count; i += 97) expect(skin.getX(i)).toBeLessThan(bones);
        // Enemies are mirror images so both sides show their weapon side to the camera.
        expect(character.root.scale.x).toBe(team === 'enemy' ? -1 : 1);
        character.dispose();
      }
    }
    kit.dispose();
  });

  it('holds a weapon in hand for every class, so gear can be swapped per bone', () => {
    const kit = createCharacterKit(false);
    for (const classId of classIds) {
      const character = kit.create(classId, 'player', 0);
      const hands = ['handL', 'handR', 'foreR'].flatMap((name) => {
        const bone = character.root.getObjectByName(name);
        return bone ? bone.children.filter((child) => !(child instanceof Bone)) : [];
      });
      expect(hands.length, classId).toBeGreaterThan(0);
    }
  });

  it('plays every state without errors and keeps the feet on the ground', () => {
    const kit = createCharacterKit(false);
    for (const classId of classIds) {
      const character = kit.create(classId, 'player', 0.3);
      character.setBase('walk');
      character.update(0.2);
      character.act('attack', 0.3);
      character.update(0.3);
      character.act('special', 0.2);
      character.act('hit', 0.1);
      character.spin(0.4);
      character.setBase('guard');
      for (let i = 0; i < 20; i++) character.update(0.05);
      character.root.updateMatrixWorld(true);
      const head = character.root.getObjectByName('head')!.getWorldPosition(new Vector3());
      expect(head.y, classId).toBeGreaterThan(CHARACTER_HEIGHT * 0.6);
      expect(head.y, classId).toBeLessThan(CHARACTER_HEIGHT);
    }
  });

  it('aims its weapon at the enemy at the key moment of an attack', () => {
    const kit = createCharacterKit(false);
    for (const classId of ['archer', 'gunner', 'witch', 'lancer']) {
      for (const [team, direction] of [
        ['player', 1],
        ['enemy', -1],
      ] as const) {
        const character = kit.create(classId, team, 0);
        character.act('attack', 0.2);
        // Step to the contact frame: half of the clip.
        for (let i = 0; i < 4; i++) character.update(0.05);
        character.root.updateMatrixWorld(true);
        const muzzle = character.muzzle(new Vector3());
        expect(muzzle.x * direction, `${classId} ${team}`).toBeGreaterThan(0.35);
        expect(muzzle.y, `${classId} ${team}`).toBeGreaterThan(0.8);
      }
    }
  });

  it('falls and stays down when defeated', () => {
    const kit = createCharacterKit(false);
    const character = kit.create('fighter', 'player', 0);
    character.die();
    for (let i = 0; i < 30; i++) character.update(0.05);
    // Dead characters ignore further orders.
    character.act('attack', 0.2);
    character.setBase('walk');
    for (let i = 0; i < 10; i++) character.update(0.05);
    character.root.updateMatrixWorld(true);
    const head = character.root.getObjectByName('head')!.getWorldPosition(new Vector3());
    expect(head.y).toBeLessThan(0.4);
  });

  it('holds still under reduced motion until something happens', () => {
    const kit = createCharacterKit(true);
    const character = kit.create('cleric', 'player', 0.5);
    character.root.updateMatrixWorld(true);
    const chest = () => character.root.getObjectByName('chest')!.quaternion.toArray().join();
    character.update(0.01);
    const before = chest();
    for (let i = 0; i < 20; i++) character.update(0.1);
    expect(chest()).toBe(before);
  });
});
