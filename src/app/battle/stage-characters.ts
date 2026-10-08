import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/*
 * Battle characters: rigged models built in Blender (tools/characters/build.py)
 * from CC0 parts, animated with one shared clip library on the same skeleton.
 * Weapons are attached to hand bones, so equipment can be swapped per bone.
 */

export type Team = 'player' | 'enemy';
export type BaseState = 'idle' | 'walk' | 'guard';
export type ActionName = 'attack' | 'special' | 'hit';

/** A larger head pulls the realistic base bodies toward Grand Kingdom's proportions. */
const HEAD_SCALE = 1.22;
/** Top of the head above the ground, in metres, with the larger head. */
export const CHARACTER_HEIGHT = 1.9;
/** Stances are turned a little toward the camera, like a fighting game... */
const FACING_YAW = THREE.MathUtils.degToRad(58);
/** ...and actions turn square to the enemy, so weapons point along the lane. */
const ACTION_YAW = THREE.MathUtils.degToRad(88);
const TEAM_COLOR: Record<Team, number> = { player: 0x2f6fe8, enemy: 0xc8322a };
const FADE = 0.15;

interface ClipRef {
  readonly clip: string;
  /** Fraction of the clip where the strike lands or the shot leaves. */
  readonly key?: number;
}

interface Moves {
  readonly idle: string;
  readonly attack: ClipRef;
  readonly special: ClipRef;
  /** Hair tint over the greyscale hair texture. */
  readonly hair: number;
}

const MOVES: Record<string, Moves> = {
  fighter: {
    idle: 'Sword_Idle',
    attack: { clip: 'Sword_Attack', key: 0.42 },
    special: { clip: 'Spell_Simple_Shoot', key: 0.45 },
    hair: 0x3a2618,
  },
  lancer: {
    idle: 'Sword_Idle',
    attack: { clip: 'Punch_Cross', key: 0.5 },
    special: { clip: 'Sword_Attack', key: 0.42 },
    hair: 0xc9a25a,
  },
  archer: {
    idle: 'Idle_Loop',
    attack: { clip: 'Bow_Shoot', key: 0.59 },
    special: { clip: 'Bow_Shoot', key: 0.59 },
    hair: 0x5a3a1e,
  },
  gunner: {
    idle: 'Pistol_Idle_Loop',
    attack: { clip: 'Pistol_Shoot', key: 0.2 },
    special: { clip: 'Pistol_Shoot', key: 0.2 },
    hair: 0x2a1c14,
  },
  cleric: {
    idle: 'Idle_Loop',
    attack: { clip: 'Spell_Simple_Shoot', key: 0.45 },
    special: { clip: 'Spell_Simple_Shoot', key: 0.45 },
    hair: 0xe3c27a,
  },
  witch: {
    idle: 'Idle_Loop',
    attack: { clip: 'Punch_Cross', key: 0.5 },
    special: { clip: 'Spell_Simple_Shoot', key: 0.45 },
    hair: 0x7b6cf0,
  },
};

export interface Character {
  /** Feet at the origin, facing its enemy. Add it to the scene and move it freely. */
  readonly root: THREE.Group;
  /** The looping or held state underneath any one-shot action. */
  setBase(state: BaseState): void;
  /** Play a one-shot whose key moment (the hit, the release) lands `contact` seconds in. */
  act(name: ActionName, contact: number): void;
  /** One full turn on the spot over `seconds`. */
  spin(seconds: number): void;
  die(): void;
  /** 0..1 white flash for hits. */
  flash(amount: number): void;
  /** World position that projectiles leave from. */
  muzzle(out: THREE.Vector3): THREE.Vector3;
  update(dt: number): void;
  dispose(): void;
}

export interface CharacterKit {
  create(classId: string, team: Team, phase: number): Character;
  dispose(): void;
}

/** Parsed assets: one model per class plus the shared clip library. */
export interface CharacterAssets {
  readonly models: ReadonlyMap<string, THREE.Object3D>;
  readonly clips: readonly THREE.AnimationClip[];
}

export async function loadCharacterAssets(classIds: readonly string[]): Promise<CharacterAssets> {
  // tools/characters/build.py meshopt-compresses every file.
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [library, ...models] = await Promise.all([
    loader.loadAsync('assets/characters/animations.glb'),
    ...classIds.map((id) => loader.loadAsync(`assets/characters/${id}.glb`)),
  ]);
  return {
    models: new Map(classIds.map((id, i) => [id, models[i].scene])),
    clips: library.animations,
  };
}

/**
 * Library clips come from one mannequin; only rotations (plus the pelvis
 * height) transfer cleanly to bodies of other sizes.
 */
function retarget(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.filter(
    (track) => track.name.endsWith('.quaternion') || track.name === 'pelvis.position',
  );
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

export function createCharacterKit(assets: CharacterAssets, reducedMotion: boolean): CharacterKit {
  const clips = new Map(assets.clips.map((clip) => [clip.name, retarget(clip)]));

  const create = (classId: string, team: Team, phase: number): Character => {
    const moves = MOVES[classId] ?? MOVES['fighter'];
    const source = assets.models.get(classId) ?? assets.models.values().next().value!;
    const model = cloneSkinned(source);
    const materials: THREE.MeshStandardMaterial[] = [];
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      // Poses and lunges leave the bind-pose bounds, so never cull.
      mesh.frustumCulled = false;
      const own = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
        const copy = (m as THREE.MeshStandardMaterial).clone();
        if (copy.name === 'Team') copy.color.set(TEAM_COLOR[team]);
        if (copy.name.startsWith('MI_Hair')) copy.color.set(moves.hair);
        copy.userData['emissive'] = copy.emissive.clone();
        materials.push(copy);
        return copy;
      });
      mesh.material = Array.isArray(mesh.material) ? own : own[0];
    });
    const head = model.getObjectByName('Head');
    head?.scale.setScalar(HEAD_SCALE);
    const muzzle = model.getObjectByName('Muzzle') ?? head ?? model;

    // glTF faces +Z; turn to face +X (toward the enemy), a little toward the camera.
    const facing = new THREE.Group();
    facing.rotation.y = FACING_YAW;
    facing.add(model);
    const root = new THREE.Group();
    root.add(facing);
    // Enemies are mirror images, so both sides show their weapon hand to the camera.
    if (team === 'enemy') root.scale.x = -1;

    const mixer = new THREE.AnimationMixer(model);
    const action = (name: string) => mixer.clipAction(clips.get(name) ?? clips.get('Idle_Loop')!);
    const bases: Record<BaseState, THREE.AnimationAction> = {
      idle: action(moves.idle),
      walk: action('Walk_Loop'),
      // The Guard shield already marks guarding; the stance stays ready.
      guard: action(moves.idle),
    };
    const once = (ref: ClipRef) => {
      const a = action(ref.clip);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      return a;
    };
    const actions = {
      attack: once(moves.attack),
      special: once(moves.special),
      hit: once({ clip: 'Hit_Chest' }),
    };
    const death = once({ clip: 'Death01' });
    const keys: Record<ActionName, number> = {
      attack: moves.attack.key ?? 0.5,
      special: moves.special.key ?? 0.5,
      hit: 0.3,
    };

    let base: BaseState = 'idle';
    let active = bases.idle.play();
    active.time = phase * active.getClip().duration;
    if (reducedMotion) bases.idle.timeScale = 0;
    let dead = false;
    let turn = 0;
    let turnUntil = 0;
    let spinLeft = 0;
    let spinTotal = 1;
    let clock = 0;

    const switchTo = (next: THREE.AnimationAction, fade: number) => {
      if (next === active) return;
      next.enabled = true;
      next.setEffectiveWeight(1);
      next.play();
      active.crossFadeTo(next, fade, false);
      active = next;
    };
    mixer.addEventListener('finished', (event) => {
      // A finished one-shot holds its last frame while the base state fades back in.
      if (event.action === active && !dead) switchTo(bases[base].reset(), FADE);
    });

    return {
      root,
      setBase(state) {
        if (dead || state === base) return;
        const wasBase = active === bases[base];
        base = state;
        if (wasBase) switchTo(bases[state].reset(), FADE);
      },
      act(name, contact) {
        if (dead) return;
        const next = actions[name];
        const clip = next.getClip();
        next.reset();
        // Time the clip so its key moment lands on the choreography's beat.
        next.timeScale = (keys[name] * clip.duration) / Math.max(0.08, contact);
        if (name !== 'hit') turnUntil = clock + contact + 0.35;
        if (next === active) return;
        switchTo(next, Math.min(0.08, contact * 0.4));
      },
      spin(seconds) {
        if (reducedMotion) return;
        spinTotal = spinLeft = Math.max(0.1, seconds);
      },
      die() {
        if (dead) return;
        dead = true;
        turnUntil = 0;
        switchTo(death.reset(), 0.08);
      },
      flash(amount) {
        for (const m of materials) {
          m.emissive.copy(m.userData['emissive'] as THREE.Color).lerp(WHITE, amount * 0.45);
        }
      },
      muzzle(out) {
        return muzzle.getWorldPosition(out);
      },
      update(dt) {
        clock += dt;
        mixer.update(dt);
        // Ease toward square-on while acting, back to the three-quarter stance after.
        const wanted = clock < turnUntil ? 1 : 0;
        turn += (wanted - turn) * Math.min(1, dt * 12);
        let yaw = FACING_YAW + (ACTION_YAW - FACING_YAW) * turn;
        if (spinLeft > 0) {
          spinLeft = Math.max(0, spinLeft - dt);
          yaw += (1 - spinLeft / spinTotal) * Math.PI * 2;
        }
        facing.rotation.y = yaw;
      },
      dispose() {
        mixer.stopAllAction();
        mixer.uncacheRoot(model);
        for (const m of materials) m.dispose();
      },
    };
  };

  return {
    create,
    dispose() {
      // Models and clips belong to the loaded assets; characters dispose their own materials.
    },
  };
}

const WHITE = new THREE.Color(0xffffff);
