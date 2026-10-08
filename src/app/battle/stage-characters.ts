import * as THREE from 'three';

/*
 * Procedural 3D characters for the battle stage: one shared humanoid skeleton,
 * class outfits sculpted from primitives into a single skinned mesh, weapons as
 * attachments on hand bones (so gear can be swapped), cel shading with an ink
 * outline, and animation clips per weapon style. No model files: everything is
 * built here, so a class is data, and a Blender-made model on the same bone names
 * could replace any of them later.
 */

export type Team = 'player' | 'enemy';
type V3 = readonly [number, number, number];

/** Bind pose: standing, arms down, facing +Z. Right-side bones face the camera. */
const BONES = [
  ['root', null, [0, 0, 0]],
  ['hips', 'root', [0, 0.86, 0]],
  ['spine', 'hips', [0, 0.1, 0]],
  ['chest', 'spine', [0, 0.17, 0]],
  ['neck', 'chest', [0, 0.25, 0]],
  ['head', 'neck', [0, 0.07, 0]],
  ['armL', 'chest', [0.2, 0.19, 0]],
  ['foreL', 'armL', [0, -0.25, 0]],
  ['handL', 'foreL', [0, -0.23, 0]],
  ['armR', 'chest', [-0.2, 0.19, 0]],
  ['foreR', 'armR', [0, -0.25, 0]],
  ['handR', 'foreR', [0, -0.23, 0]],
  ['legL', 'hips', [0.1, -0.04, 0]],
  ['shinL', 'legL', [0, -0.4, 0]],
  ['footL', 'shinL', [0, -0.36, 0]],
  ['legR', 'hips', [-0.1, -0.04, 0]],
  ['shinR', 'legR', [0, -0.4, 0]],
  ['footR', 'shinR', [0, -0.36, 0]],
] as const;

type BoneName = (typeof BONES)[number][0];
const BONE_INDEX = new Map<BoneName, number>(BONES.map(([name], index) => [name, index]));
const BIND = new Map<BoneName, THREE.Vector3>();
for (const [name, parent, [x, y, z]] of BONES) {
  BIND.set(name, new THREE.Vector3(x, y, z).add(parent ? BIND.get(parent)! : new THREE.Vector3()));
}

/** Model units are metres at human scale; the stage draws characters a little larger. */
const SCALE = 1.12;
/** Top of a bare head above the ground; hats and helmets rise above it. */
export const CHARACTER_HEIGHT = 1.78 * SCALE;
/** Stances are turned a little toward the camera, like a fighting game... */
const FACING_DEGREES = 58;
const FACING_YAW = THREE.MathUtils.degToRad(FACING_DEGREES);
/** ...and actions turn nearly square to the enemy, so weapons point along the lane. */
const ACTION_TURN: V3 = [0, 90 - FACING_DEGREES - 4, 0];
const OUTLINE = 0.017;
const INK = 0x0b0e17;
const SKIN = 0xf1c9a5;
const ZERO: V3 = [0, 0, 0];
const rad = THREE.MathUtils.degToRad;

// ---------------------------------------------------------------------------
// Sculpting: coloured primitives merged into one geometry, each bound to a bone

const matrix = new THREE.Matrix4();
const euler = new THREE.Euler();
const tint = new THREE.Color();

class Sculptor {
  private readonly position: number[] = [];
  private readonly normal: number[] = [];
  private readonly color: number[] = [];
  private readonly skin: number[] = [];

  /** `bone` null sculpts in local space, for attachments. */
  constructor(private readonly skinned: boolean) {}

  add(
    bone: BoneName | null,
    geometry: THREE.BufferGeometry,
    hex: number,
    at: V3 = ZERO,
    rot: V3 = ZERO,
  ): this {
    const origin = bone && this.skinned ? BIND.get(bone)! : null;
    matrix
      .makeRotationFromEuler(euler.set(rad(rot[0]), rad(rot[1]), rad(rot[2])))
      .setPosition(at[0] + (origin?.x ?? 0), at[1] + (origin?.y ?? 0), at[2] + (origin?.z ?? 0));
    geometry.applyMatrix4(matrix);
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    const positions = flat.getAttribute('position');
    const normals = flat.getAttribute('normal');
    tint.set(hex);
    for (let i = 0; i < positions.count; i++) {
      this.position.push(positions.getX(i), positions.getY(i), positions.getZ(i));
      this.normal.push(normals.getX(i), normals.getY(i), normals.getZ(i));
      this.color.push(tint.r, tint.g, tint.b);
      this.skin.push(bone ? BONE_INDEX.get(bone)! : 0);
    }
    geometry.dispose();
    flat.dispose();
    return this;
  }

  /** Sphere or ellipsoid. */
  ball(bone: BoneName | null, hex: number, radii: number | V3, at: V3 = ZERO, rot: V3 = ZERO) {
    const [x, y, z] = typeof radii === 'number' ? [radii, radii, radii] : radii;
    const geometry = new THREE.SphereGeometry(1, 12, 9);
    geometry.applyMatrix4(matrix.makeScale(x, y, z));
    return this.add(bone, geometry, hex, at, rot);
  }

  /** Cylinder or cone along Y, centred on `at`. */
  tube(
    bone: BoneName | null,
    hex: number,
    top: number,
    bottom: number,
    height: number,
    at: V3 = ZERO,
    rot: V3 = ZERO,
    sides = 10,
  ) {
    return this.add(bone, new THREE.CylinderGeometry(top, bottom, height, sides), hex, at, rot);
  }

  /** Capsule hanging from the bone's joint to the next one. */
  limb(bone: BoneName, hex: number, radius: number, length: number) {
    const geometry = new THREE.CapsuleGeometry(radius, length - radius * 0.6, 3, 8);
    return this.add(bone, geometry, hex, [0, -length / 2, 0]);
  }

  box(bone: BoneName | null, hex: number, size: V3, at: V3 = ZERO, rot: V3 = ZERO) {
    return this.add(bone, new THREE.BoxGeometry(size[0], size[1], size[2]), hex, at, rot);
  }

  ring(bone: BoneName | null, hex: number, radius: number, thickness: number, at: V3, rot: V3) {
    return this.add(bone, new THREE.TorusGeometry(radius, thickness, 6, 18), hex, at, rot);
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normal, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
    if (this.skinned) {
      const count = this.skin.length;
      const index = new Uint16Array(count * 4);
      const weight = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) {
        index[i * 4] = this.skin[i];
        weight[i * 4] = 1;
      }
      geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4));
      geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weight, 4));
    }
    return geometry;
  }
}

// ---------------------------------------------------------------------------
// Class looks

type Style = 'sword' | 'lance' | 'bow' | 'gun' | 'staff' | 'orb';

interface Attachment {
  readonly bone: BoneName;
  readonly geometry: THREE.BufferGeometry;
  /** Unlit colour for things that glow (orbs, halos, visor eyes). */
  readonly glow?: number;
  /** Floats gently, like the witch's orb. */
  readonly hover?: boolean;
  /** How the piece sits in the hand, in degrees. */
  readonly rot?: V3;
}

interface Blueprint {
  readonly style: Style;
  readonly body: THREE.BufferGeometry;
  readonly attachments: readonly Attachment[];
  /** Where projectiles leave from, in a bone's local space. */
  readonly muzzle: { readonly bone: BoneName; readonly at: V3 };
}

interface BodyLook {
  readonly torso: number;
  readonly waist?: number;
  readonly hips: number;
  readonly sleeve: number;
  readonly forearm: number;
  readonly hand?: number;
  readonly thigh: number;
  readonly shin: number;
  readonly foot: number;
}

function body(s: Sculptor, look: BodyLook) {
  s.ball('hips', look.hips, [0.15, 0.11, 0.115]);
  s.tube('spine', look.waist ?? look.torso, 0.14, 0.13, 0.17, [0, 0.03, 0]);
  s.ball('chest', look.torso, [0.185, 0.165, 0.13], [0, 0.09, 0]);
  s.tube('neck', SKIN, 0.05, 0.056, 0.1, [0, 0.01, 0]);
  s.ball('head', SKIN, [0.15, 0.165, 0.16], [0, 0.15, 0.01]);
  for (const side of ['L', 'R'] as const) {
    s.ball(`arm${side}`, look.sleeve, 0.078);
    s.limb(`arm${side}`, look.sleeve, 0.06, 0.25);
    s.limb(`fore${side}`, look.forearm, 0.052, 0.23);
    s.ball(`hand${side}`, look.hand ?? SKIN, 0.056, [0, -0.03, 0]);
    s.limb(`leg${side}`, look.thigh, 0.08, 0.4);
    s.limb(`shin${side}`, look.shin, 0.064, 0.36);
    s.ball(`foot${side}`, look.foot, [0.058, 0.045, 0.125], [0, -0.018, 0.05]);
  }
}

function face(s: Sculptor) {
  for (const x of [0.058, -0.058])
    s.ball('head', 0x1b1f2e, [0.023, 0.036, 0.014], [x, 0.14, 0.157]);
}

function hair(s: Sculptor, hex: number) {
  s.ball('head', hex, [0.162, 0.166, 0.168], [0, 0.19, -0.034]);
}

/** A closed helm with a dark visor slit; the glowing eyes are an attachment. */
function helm(s: Sculptor, hex: number) {
  s.tube('head', hex, 0.172, 0.172, 0.2, [0, 0.12, 0.005], ZERO, 12);
  s.ball('head', hex, [0.172, 0.12, 0.172], [0, 0.22, 0.005]);
  s.box('head', 0x0c1018, [0.26, 0.04, 0.06], [0, 0.15, 0.15]);
}

function visorEyes(hex: number): Attachment {
  const s = new Sculptor(false);
  for (const x of [0.055, -0.055]) s.ball(null, hex, 0.017, [x, 0.15, 0.176]);
  return { bone: 'head', geometry: s.build(), glow: hex };
}

/** A robe or coat skirt hanging from the hips down to `length` below them. */
function skirt(s: Sculptor, hex: number, top: number, hem: number, length: number) {
  s.tube('hips', hex, top, hem, length, [0, 0.02 - length / 2, 0], ZERO, 12);
}

function build(classId: string, team: Team): Blueprint {
  const pick = (player: number, enemy: number) => (team === 'player' ? player : enemy);
  const s = new Sculptor(true);
  const attachments: Attachment[] = [];
  /** Sculpt an attachment in a bone's local space. */
  const attach = (
    bone: BoneName,
    sculpt: (a: Sculptor) => void,
    options: Omit<Attachment, 'bone' | 'geometry'> = {},
  ) => {
    const a = new Sculptor(false);
    sculpt(a);
    attachments.push({ bone, geometry: a.build(), ...options });
  };
  const steel = pick(0xb9c4d6, 0x596275);
  const gold = 0xe2b33c;
  const leather = 0x6b4423;
  const wood = 0x7a4a22;

  switch (classId) {
    case 'cleric': {
      const robe = pick(0xf2f0e8, 0x7a1f24);
      const trim = pick(0xd9b24a, 0xe2b33c);
      body(s, {
        torso: robe,
        hips: robe,
        sleeve: robe,
        forearm: robe,
        thigh: robe,
        shin: robe,
        foot: leather,
      });
      face(s);
      skirt(s, robe, 0.16, 0.33, 0.8);
      s.tube('hips', trim, 0.325, 0.335, 0.04, [0, -0.76, 0], ZERO, 12);
      s.tube('chest', trim, 0.1, 0.235, 0.13, [0, 0.19, 0], ZERO, 12);
      for (const side of ['L', 'R'] as const)
        s.tube(`fore${side}`, robe, 0.06, 0.105, 0.2, [0, -0.13, 0]);
      for (const x of [0.055, -0.055])
        s.box('chest', trim, [0.04, 0.42, 0.02], [x, -0.1, 0.128], [-4, 0, 0]);
      s.ball('head', robe, [0.182, 0.186, 0.172], [0, 0.2, -0.078]);
      s.ball('head', pick(0xe8c56a, 0x2a1a14), [0.125, 0.05, 0.07], [0, 0.262, 0.085]);
      attach('head', (a) => a.ring(null, 0xffe27a, 0.13, 0.013, [0, 0.45, 0], [90, 0, 0]), {
        glow: 0xffe27a,
      });
      attach('handR', (a) => {
        a.tube(null, wood, 0.019, 0.019, 1.85, [0, 0, -0.14], [90, 0, 0], 6);
        a.ring(null, gold, 0.085, 0.016, [0, 0, 0.88], [0, 90, 0]);
      });
      attach('handR', (a) => a.ball(null, 0x8fe6ff, 0.04, [0, 0, 0.88]), { glow: 0x8fe6ff });
      return {
        style: 'staff',
        body: s.build(),
        attachments,
        muzzle: { bone: 'handR', at: [0, 0, 0.88] },
      };
    }
    case 'archer': {
      const cloth = pick(0x2f7d46, 0x8f2a22);
      const dark = pick(0x215c33, 0x6a1c17);
      body(s, {
        torso: cloth,
        hips: cloth,
        sleeve: cloth,
        forearm: leather,
        thigh: 0x6d5236,
        shin: leather,
        foot: leather,
      });
      face(s);
      hair(s, 0x8a5a2b);
      skirt(s, cloth, 0.15, 0.215, 0.22);
      s.tube('spine', leather, 0.148, 0.148, 0.045, [0, -0.02, 0], ZERO, 12);
      s.ball('spine', gold, 0.03, [0, -0.02, 0.14]);
      s.tube('head', dark, 0.0, 0.17, 0.24, [0, 0.31, -0.06], [-38, 0, 0], 10);
      s.tube('head', dark, 0.19, 0.19, 0.03, [0, 0.235, 0.0], [-8, 0, 0], 12);
      s.tube(
        'head',
        pick(0xf2c230, 0xf08a24),
        0.004,
        0.022,
        0.26,
        [0.11, 0.37, -0.1],
        [-40, 0, -18],
        5,
      );
      s.tube('chest', leather, 0.055, 0.045, 0.34, [-0.07, 0.06, -0.16], [14, 0, 22], 8);
      for (const x of [-0.13, -0.1, -0.16])
        s.tube('chest', 0xe8e2d0, 0.008, 0.008, 0.12, [x, 0.27, -0.2], [14, 0, 22], 4);
      attach('handL', (a) => {
        const limbs = new THREE.CatmullRomCurve3(
          [
            [0.12, 0.5],
            [0.02, 0.3],
            [-0.06, 0],
            [0.02, -0.3],
            [0.12, -0.5],
          ].map(([y, z]) => new THREE.Vector3(0, y, z)),
        );
        a.add(null, new THREE.TubeGeometry(limbs, 18, 0.016, 6), wood);
        a.tube(null, 0xe8e2d0, 0.004, 0.004, 1, [0, 0.12, 0], [90, 0, 0], 4);
      });
      return {
        style: 'bow',
        body: s.build(),
        attachments,
        muzzle: { bone: 'handL', at: [0, -0.06, 0] },
      };
    }
    case 'witch': {
      const robe = pick(0x2b2670, 0x4b1272);
      const trim = pick(0x8f5cf0, 0xe0569b);
      const hat = pick(0x1f1b56, 0x380c58);
      body(s, {
        torso: robe,
        hips: robe,
        sleeve: robe,
        forearm: robe,
        thigh: robe,
        shin: robe,
        foot: 0x1b1730,
      });
      face(s);
      hair(s, pick(0x6b6ff2, 0xc58cf5));
      s.ball('head', pick(0x6b6ff2, 0xc58cf5), [0.15, 0.3, 0.1], [0, -0.04, -0.12]);
      skirt(s, robe, 0.16, 0.35, 0.8);
      s.tube('hips', trim, 0.345, 0.355, 0.04, [0, -0.76, 0], ZERO, 12);
      s.tube('spine', trim, 0.148, 0.148, 0.04, [0, -0.02, 0], ZERO, 12);
      for (const side of ['L', 'R'] as const)
        s.tube(`fore${side}`, robe, 0.058, 0.11, 0.2, [0, -0.13, 0]);
      s.tube('head', hat, 0.31, 0.31, 0.025, [0, 0.25, 0], [-8, 0, 0], 14);
      s.tube('head', hat, 0.0, 0.15, 0.36, [0, 0.43, -0.03], [-10, 0, 0], 10);
      s.tube('head', hat, 0.0, 0.05, 0.16, [0, 0.64, -0.1], [-55, 0, 0], 8);
      s.tube('head', gold, 0.15, 0.156, 0.045, [0, 0.285, -0.008], [-8, 0, 0], 12);
      const orb = pick(0x8f9bff, 0xff5a8a);
      attach('handR', (a) => a.ball(null, orb, 0.085, [0, -0.07, 0.17]), {
        glow: orb,
        hover: true,
      });
      return {
        style: 'orb',
        body: s.build(),
        attachments,
        muzzle: { bone: 'handR', at: [0, -0.07, 0.17] },
      };
    }
    case 'lancer': {
      const mail = pick(0x1f6fb5, 0x9a2420);
      const dark = pick(0x14466f, 0x5e1513);
      const accent = pick(0x4fc3ff, 0xff5a4f);
      body(s, {
        torso: mail,
        hips: dark,
        sleeve: mail,
        forearm: dark,
        hand: dark,
        thigh: 0x2a3140,
        shin: dark,
        foot: dark,
      });
      helm(s, mail);
      s.box('head', accent, [0.025, 0.15, 0.28], [0, 0.37, -0.02]);
      for (const side of [1, -1])
        s.tube('head', gold, 0.0, 0.04, 0.2, [side * 0.18, 0.27, -0.03], [-25, 0, side * -28], 6);
      for (const side of ['L', 'R'] as const)
        s.ball(`arm${side}`, gold, [0.1, 0.07, 0.1], [0, 0.03, 0]);
      skirt(s, mail, 0.15, 0.2, 0.17);
      s.tube('spine', gold, 0.148, 0.148, 0.04, [0, -0.02, 0], ZERO, 12);
      s.box('chest', accent, [0.3, 0.56, 0.02], [0, -0.12, -0.15], [9, 0, 0]);
      attachments.push(visorEyes(accent));
      // Couched under the arm, pointing at the enemy.
      attach(
        'handR',
        (a) => {
          a.tube(null, wood, 0.02, 0.02, 2.3, [0, 0.3, 0], ZERO, 6);
          a.tube(null, 0xe6edf7, 0.0, 0.06, 0.34, [0, 1.62, 0], ZERO, 4);
          a.tube(null, gold, 0.045, 0.045, 0.05, [0, 1.43, 0], ZERO, 8);
          a.box(null, accent, [0.012, 0.16, 0.26], [0, 1.3, 0.15]);
        },
        { rot: [150, 0, 0] },
      );
      return {
        style: 'lance',
        body: s.build(),
        attachments,
        muzzle: { bone: 'handR', at: [0, -1.47, 0.85] },
      };
    }
    case 'gunner': {
      const coat = pick(0x23408f, 0x7a431a);
      const dark = 0x1c2230;
      body(s, {
        torso: coat,
        hips: coat,
        sleeve: coat,
        forearm: coat,
        hand: leather,
        thigh: dark,
        shin: 0x15181f,
        foot: 0x15181f,
      });
      face(s);
      hair(s, 0x3a2a1c);
      skirt(s, coat, 0.165, 0.27, 0.46);
      s.ring('chest', leather, 0.185, 0.02, [0, 0.03, 0], [78, 28, 0]);
      for (const y of [0.13, 0.05, -0.03]) s.ball('chest', gold, 0.018, [0.02 - y * 0.5, y, 0.135]);
      s.tube('head', dark, 0.3, 0.3, 0.035, [0, 0.265, 0], [0, 60, 0], 3);
      s.tube('head', dark, 0.12, 0.15, 0.11, [0, 0.32, 0], ZERO, 10);
      s.tube('head', gold, 0.152, 0.152, 0.02, [0, 0.285, 0], ZERO, 10);
      s.tube(
        'head',
        pick(0xf2a630, 0xe5483d),
        0.004,
        0.024,
        0.28,
        [-0.13, 0.4, -0.06],
        [-35, 0, 22],
        5,
      );
      attach('handR', (a) => {
        a.tube(null, 0x6f7885, 0.02, 0.022, 0.82, [0, -0.36, 0.02], ZERO, 8);
        a.box(null, wood, [0.05, 0.34, 0.08], [0, 0.1, -0.01], [-8, 0, 0]);
        a.box(null, wood, [0.04, 0.3, 0.05], [0, -0.14, -0.005]);
        a.ball(null, gold, 0.026, [0, 0.0, 0.05]);
      });
      return {
        style: 'gun',
        body: s.build(),
        attachments,
        muzzle: { bone: 'handR', at: [0, -0.78, 0.02] },
      };
    }
    default: {
      // Fighter: plate armour, shield on the camera-side arm, sword in the far hand.
      const cloth = pick(0x2c62d6, 0xa3221c);
      body(s, {
        torso: steel,
        hips: cloth,
        sleeve: steel,
        forearm: steel,
        hand: steel,
        thigh: 0x2a3140,
        shin: steel,
        foot: steel,
      });
      helm(s, steel);
      s.tube('head', pick(0xf2a630, 0xe5483d), 0.0, 0.06, 0.24, [0, 0.4, -0.05], [-28, 0, 0], 8);
      for (const side of ['L', 'R'] as const)
        s.ball(`arm${side}`, steel, [0.105, 0.075, 0.105], [0, 0.03, 0]);
      skirt(s, cloth, 0.155, 0.21, 0.19);
      s.tube('spine', gold, 0.15, 0.15, 0.04, [0, -0.02, 0], ZERO, 12);
      s.box('chest', gold, [0.03, 0.2, 0.02], [0, 0.08, 0.128]);
      attachments.push(visorEyes(pick(0x57d0ff, 0xff6b5e)));
      attach('foreR', (a) => {
        a.ball(null, gold, [0.03, 0.2, 0.3], [-0.085, -0.1, 0.03]);
        a.ball(null, cloth, [0.035, 0.165, 0.265], [-0.092, -0.1, 0.03]);
        a.ball(null, gold, 0.045, [-0.12, -0.1, 0.03]);
      });
      attach('handL', (a) => {
        a.tube(null, leather, 0.02, 0.02, 0.15, [0, -0.02, 0], [130, 0, 0], 6);
        a.ball(null, gold, 0.03, [0, 0.06, -0.07]);
        a.box(null, gold, [0.18, 0.035, 0.045], [0, -0.055, 0.065], [130, 0, 0]);
        a.box(null, 0xe6edf7, [0.055, 0.68, 0.016], [0, -0.285, 0.34], [130, 0, 0]);
      });
      return {
        style: 'sword',
        body: s.build(),
        attachments,
        muzzle: { bone: 'handL', at: [0, -0.3, 0.36] },
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Animation: poses in degrees per bone, sampled into clips with easing

type Pose = Partial<Record<BoneName, V3>> & { readonly drop?: number; readonly lift?: number };
type Ease = 'smooth' | 'in' | 'out';
interface Key {
  readonly at: number;
  readonly pose: Pose;
  /** How the motion arrives at this key. */
  readonly ease?: Ease;
}

export type BaseState = 'idle' | 'walk' | 'guard';
export type ActionName = 'attack' | 'special' | 'hit';
type ClipName = BaseState | ActionName | 'death';

const LEGS: Pose = {
  legL: [-16, 0, 3],
  shinL: [14, 0, 0],
  footL: [2, 0, 0],
  legR: [12, 0, -4],
  shinR: [16, 0, 0],
  footR: [-28, 0, 0],
};
const ROBE_LEGS: Pose = {
  legL: [-5, 0, 2],
  legR: [5, 0, -2],
  shinR: [6, 0, 0],
  footR: [-11, 0, 0],
};

interface StyleMoves {
  readonly stance: Pose;
  readonly guard: Pose;
  /** Each lists the poses between stance (start) and stance (end); 0.5 is the key moment. */
  readonly attack: readonly Key[];
  readonly special: readonly Key[];
  /** Leg swing scale; robes take small steps. */
  readonly stride: number;
}

const STYLES: Record<Style, StyleMoves> = {
  sword: {
    stride: 1,
    stance: {
      ...LEGS,
      drop: 0.02,
      spine: [5, 0, 0],
      chest: [3, -8, 0],
      head: [-4, 6, 0],
      armR: [-22, 0, -10],
      foreR: [-68, 0, 0],
      armL: [-55, 0, 8],
      foreL: [-50, 0, 0],
    },
    guard: {
      drop: 0.08,
      legL: [-26, 0, 3],
      shinL: [32, 0, 0],
      legR: [8, 0, -4],
      shinR: [30, 0, 0],
      spine: [10, 0, 0],
      armR: [-62, 0, 8],
      foreR: [-74, 0, 0],
      armL: [-20, 0, 12],
      foreL: [-78, 0, 0],
    },
    attack: [
      {
        at: 0.3,
        pose: { armL: [-165, 0, 18], foreL: [-48, 0, 0], chest: [-6, 22, 0], spine: [-4, 0, 0] },
      },
      {
        at: 0.5,
        ease: 'in',
        pose: {
          armL: [-38, 0, 4],
          foreL: [-16, 0, 0],
          chest: [14, -24, 0],
          spine: [14, 0, 0],
          legL: [-32, 0, 3],
          shinL: [30, 0, 0],
          drop: 0.07,
        },
      },
      {
        at: 0.66,
        pose: {
          armL: [-26, 0, 2],
          foreL: [-12, 0, 0],
          chest: [16, -26, 0],
          spine: [15, 0, 0],
          drop: 0.08,
        },
      },
    ],
    special: [
      { at: 0.3, pose: { drop: 0.1, spine: [12, 0, 0], armR: [-40, 0, -6], foreR: [-90, 0, 0] } },
      {
        at: 0.5,
        ease: 'in',
        pose: {
          armR: [-100, 0, -22],
          foreR: [-52, 0, 0],
          armL: [-25, 0, 50],
          foreL: [-30, 0, 0],
          chest: [-10, 0, 0],
          head: [-14, 0, 0],
        },
      },
      {
        at: 0.7,
        pose: {
          armR: [-96, 0, -20],
          foreR: [-56, 0, 0],
          armL: [-25, 0, 46],
          chest: [-8, 0, 0],
          head: [-12, 0, 0],
        },
      },
    ],
  },
  lance: {
    stride: 1,
    stance: {
      ...LEGS,
      drop: 0.03,
      spine: [8, 0, 0],
      chest: [2, -10, 0],
      head: [-6, 8, 0],
      armR: [18, 0, -10],
      foreR: [-88, 0, 0],
      armL: [-35, 0, 10],
      foreL: [-55, 0, -15],
    },
    guard: {
      drop: 0.08,
      legL: [-26, 0, 3],
      shinL: [32, 0, 0],
      legR: [8, 0, -4],
      shinR: [30, 0, 0],
      spine: [6, 0, 0],
      armR: [-20, 0, -14],
      foreR: [-112, 0, 0],
      armL: [-58, 0, 8],
      foreL: [-64, 0, -24],
    },
    attack: [
      {
        at: 0.3,
        pose: { armR: [44, 0, -14], foreR: [-104, 0, 0], chest: [-2, -28, 0], spine: [-3, 0, 0] },
      },
      {
        at: 0.5,
        ease: 'in',
        pose: {
          armR: [-66, 0, -6],
          foreR: [-18, 0, 0],
          chest: [12, 28, 0],
          spine: [16, 0, 0],
          legL: [-36, 0, 3],
          shinL: [32, 0, 0],
          legR: [24, 0, -4],
          shinR: [8, 0, 0],
          drop: 0.1,
        },
      },
      {
        at: 0.64,
        pose: {
          armR: [-62, 0, -6],
          foreR: [-20, 0, 0],
          chest: [13, 26, 0],
          spine: [16, 0, 0],
          drop: 0.1,
        },
      },
    ],
    special: [
      {
        at: 0.22,
        pose: {
          armR: [-30, 0, -70],
          foreR: [-30, 0, 0],
          armL: [-30, 0, 60],
          foreL: [-20, 0, 0],
          drop: 0.06,
        },
      },
      {
        at: 0.75,
        pose: {
          armR: [-30, 0, -78],
          foreR: [-24, 0, 0],
          armL: [-30, 0, 66],
          foreL: [-16, 0, 0],
          drop: 0.06,
        },
      },
    ],
  },
  bow: {
    stride: 1,
    stance: {
      ...LEGS,
      drop: 0.01,
      spine: [4, 0, 0],
      chest: [0, -6, 0],
      head: [-3, 5, 0],
      armL: [-30, 0, 10],
      foreL: [-28, 0, 0],
      armR: [8, 0, -10],
      foreR: [-30, 0, 0],
    },
    guard: {
      drop: 0.07,
      legL: [-24, 0, 3],
      shinL: [30, 0, 0],
      legR: [8, 0, -4],
      shinR: [28, 0, 0],
      spine: [12, 0, 0],
      armL: [-70, 0, 6],
      foreL: [-40, 0, 0],
      armR: [-30, 0, -6],
      foreR: [-100, 0, 0],
    },
    attack: [
      {
        at: 0.34,
        pose: {
          armL: [-88, 0, 4],
          foreL: [0, 0, 0],
          armR: [-80, 0, -28],
          foreR: [-128, 0, 0],
          chest: [-3, -30, 0],
          head: [0, 24, 0],
        },
      },
      {
        at: 0.5,
        pose: {
          armL: [-88, 0, 4],
          foreL: [0, 0, 0],
          armR: [-84, 0, -34],
          foreR: [-134, 0, 0],
          chest: [-4, -34, 0],
          head: [0, 26, 0],
        },
      },
      {
        at: 0.58,
        ease: 'out',
        pose: {
          armL: [-86, 0, 4],
          foreL: [-4, 0, 0],
          armR: [-70, 0, -52],
          foreR: [-70, 0, 0],
          chest: [-6, -30, 0],
          head: [0, 24, 0],
        },
      },
    ],
    special: [
      {
        at: 0.34,
        pose: {
          armL: [-128, 0, 4],
          foreL: [0, 0, 0],
          armR: [-112, 0, -28],
          foreR: [-128, 0, 0],
          chest: [-16, -30, 0],
          spine: [-8, 0, 0],
          head: [-8, 24, 0],
        },
      },
      {
        at: 0.5,
        pose: {
          armL: [-128, 0, 4],
          foreL: [0, 0, 0],
          armR: [-116, 0, -34],
          foreR: [-134, 0, 0],
          chest: [-18, -34, 0],
          spine: [-9, 0, 0],
          head: [-8, 26, 0],
        },
      },
      {
        at: 0.58,
        ease: 'out',
        pose: {
          armL: [-126, 0, 4],
          armR: [-100, 0, -52],
          foreR: [-70, 0, 0],
          chest: [-18, -30, 0],
          spine: [-8, 0, 0],
          head: [-8, 24, 0],
        },
      },
    ],
  },
  gun: {
    stride: 1,
    stance: {
      ...LEGS,
      drop: 0.02,
      spine: [5, 0, 0],
      chest: [2, -12, 0],
      head: [-4, 10, 0],
      armR: [6, 0, -8],
      foreR: [-78, 0, 0],
      armL: [-48, 0, 22],
      foreL: [-48, 0, -28],
    },
    guard: {
      drop: 0.08,
      legL: [-26, 0, 3],
      shinL: [32, 0, 0],
      legR: [8, 0, -4],
      shinR: [30, 0, 0],
      spine: [12, 0, 0],
      armR: [-30, 0, -4],
      foreR: [-118, 0, 0],
      armL: [-70, 0, 20],
      foreL: [-70, 0, -30],
    },
    attack: [
      {
        at: 0.36,
        pose: {
          armR: [-68, 0, -10],
          foreR: [-22, 0, 0],
          armL: [-84, 0, 16],
          foreL: [-6, 0, -14],
          chest: [0, -18, 0],
          head: [4, 14, 0],
        },
      },
      {
        at: 0.5,
        pose: {
          armR: [-68, 0, -10],
          foreR: [-22, 0, 0],
          armL: [-84, 0, 16],
          foreL: [-6, 0, -14],
          chest: [0, -18, 0],
          head: [4, 14, 0],
        },
      },
      {
        at: 0.57,
        ease: 'out',
        pose: {
          armR: [-60, 0, -10],
          foreR: [-50, 0, 0],
          armL: [-88, 0, 16],
          foreL: [-24, 0, -14],
          chest: [-7, -18, 0],
          spine: [-6, 0, 0],
          head: [0, 14, 0],
        },
      },
      {
        at: 0.74,
        pose: {
          armR: [-66, 0, -10],
          foreR: [-24, 0, 0],
          armL: [-84, 0, 16],
          foreL: [-8, 0, -14],
          chest: [0, -18, 0],
          head: [4, 14, 0],
        },
      },
    ],
    special: [],
  },
  staff: {
    stride: 0.5,
    stance: {
      ...ROBE_LEGS,
      spine: [3, 0, 0],
      chest: [0, -6, 0],
      head: [-3, 5, 0],
      armR: [-14, 0, -12],
      foreR: [-76, 0, 0],
      armL: [-30, 0, 14],
      foreL: [-85, 0, -25],
    },
    guard: {
      drop: 0.04,
      spine: [8, 0, 0],
      armR: [-40, 0, 6],
      foreR: [-70, 0, 0],
      armL: [-52, 0, 8],
      foreL: [-70, 0, -30],
    },
    attack: [
      {
        at: 0.32,
        pose: {
          armR: [-125, 0, -14],
          foreR: [-40, 0, 0],
          chest: [-8, -4, 0],
          head: [-14, 4, 0],
          armL: [-40, 0, 20],
        },
      },
      {
        at: 0.5,
        ease: 'in',
        pose: { armR: [-66, 0, -10], foreR: [-34, 0, 0], chest: [9, -8, 0], spine: [7, 0, 0] },
      },
      {
        at: 0.66,
        pose: { armR: [-60, 0, -10], foreR: [-38, 0, 0], chest: [9, -8, 0], spine: [7, 0, 0] },
      },
    ],
    special: [
      {
        at: 0.36,
        pose: {
          armR: [-150, 0, -26],
          foreR: [-26, 0, 0],
          armL: [-150, 0, 26],
          foreL: [-26, 0, 0],
          head: [-18, 0, 0],
          chest: [-9, 0, 0],
          lift: 0.05,
        },
      },
      {
        at: 0.66,
        pose: {
          armR: [-146, 0, -30],
          foreR: [-22, 0, 0],
          armL: [-146, 0, 30],
          foreL: [-22, 0, 0],
          head: [-16, 0, 0],
          chest: [-8, 0, 0],
          lift: 0.07,
        },
      },
    ],
  },
  orb: {
    stride: 0.5,
    stance: {
      ...ROBE_LEGS,
      spine: [2, 0, 0],
      chest: [0, -8, 0],
      head: [-3, 6, 0],
      armR: [-38, 0, -14],
      foreR: [-66, 0, 0],
      armL: [12, 0, 14],
      foreL: [-25, 0, 0],
    },
    guard: {
      drop: 0.04,
      spine: [8, 0, 0],
      armR: [-50, 0, 12],
      foreR: [-90, 0, 0],
      armL: [-50, 0, -12],
      foreL: [-90, 0, 0],
    },
    attack: [
      {
        at: 0.3,
        pose: { armR: [-8, 0, -46], foreR: [-112, 0, 0], chest: [0, -30, 0], spine: [-4, 0, 0] },
      },
      {
        at: 0.5,
        ease: 'in',
        pose: {
          armR: [-90, 0, -6],
          foreR: [-8, 0, 0],
          chest: [8, 22, 0],
          spine: [8, 0, 0],
          armL: [20, 0, 30],
        },
      },
      {
        at: 0.66,
        pose: {
          armR: [-88, 0, -6],
          foreR: [-10, 0, 0],
          chest: [8, 20, 0],
          spine: [8, 0, 0],
          armL: [20, 0, 30],
        },
      },
    ],
    special: [
      {
        at: 0.36,
        pose: {
          armR: [-160, 0, -20],
          foreR: [-20, 0, 0],
          armL: [-160, 0, 20],
          foreL: [-20, 0, 0],
          chest: [-12, 0, 0],
          head: [-20, 0, 0],
          lift: 0.08,
        },
      },
      {
        at: 0.5,
        ease: 'in',
        pose: {
          armR: [-80, 0, -10],
          foreR: [-10, 0, 0],
          armL: [-80, 0, 10],
          foreL: [-10, 0, 0],
          chest: [10, 0, 0],
          spine: [10, 0, 0],
        },
      },
      {
        at: 0.68,
        pose: {
          armR: [-76, 0, -10],
          foreR: [-12, 0, 0],
          armL: [-76, 0, 10],
          foreL: [-12, 0, 0],
          chest: [10, 0, 0],
          spine: [10, 0, 0],
        },
      },
    ],
  },
};

const EASE: Record<Ease, (t: number) => number> = {
  smooth: (t) => t * t * (3 - 2 * t),
  in: (t) => t * t * t,
  out: (t) => 1 - (1 - t) ** 3,
};

const quaternion = new THREE.Quaternion();

/** Sample keys into a normalized (0..1 s) clip; unlisted bones hold the stance. */
function makeClip(name: ClipName, stance: Pose, keys: readonly Key[], samples = 28) {
  const frames = keys.map((key) => ({ ...key, pose: { ...stance, ...key.pose } as Pose }));
  const times = Array.from({ length: samples + 1 }, (_, i) => i / samples);
  const rotations = new Map<BoneName, number[]>(BONES.map(([bone]) => [bone, []]));
  const hips: number[] = [];
  const base = BONES[1][2];
  for (const time of times) {
    const next = Math.max(
      1,
      frames.findIndex((frame) => frame.at >= time),
    );
    const from = frames[next - 1];
    const to = frames[next];
    const span = to.at - from.at;
    const k = EASE[to.ease ?? 'smooth'](span > 0 ? Math.min(1, (time - from.at) / span) : 1);
    const mix = (a = 0, b = 0) => a + (b - a) * k;
    for (const [bone] of BONES) {
      const a = from.pose[bone] ?? ZERO;
      const b = to.pose[bone] ?? ZERO;
      quaternion.setFromEuler(
        euler.set(rad(mix(a[0], b[0])), rad(mix(a[1], b[1])), rad(mix(a[2], b[2]))),
      );
      rotations.get(bone)!.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    }
    hips.push(
      base[0],
      base[1] - mix(from.pose.drop, to.pose.drop) + mix(from.pose.lift, to.pose.lift),
      base[2],
    );
  }
  return new THREE.AnimationClip(name, 1, [
    ...BONES.map(
      ([bone]) =>
        new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, rotations.get(bone)!),
    ),
    new THREE.VectorKeyframeTrack('hips.position', times, hips),
  ]);
}

function makeClips(moves: StyleMoves): Record<ClipName, THREE.AnimationClip> {
  const { stance, stride } = moves;
  const rest: Key = { at: 0, pose: {} };
  const end: Key = { at: 1, pose: {} };
  const sway: Pose = {
    chest: add(stance.chest, [1.6, 0, 0]),
    head: add(stance.head, [-1.2, 0, 0]),
    armL: add(stance.armL, [0, 0, 2]),
    armR: add(stance.armR, [0, 0, -2]),
    drop: (stance.drop ?? 0) + 0.008,
  };
  const step = (forward: 'L' | 'R', lifting: boolean): Pose => {
    const back = forward === 'L' ? 'R' : 'L';
    const twist = (forward === 'L' ? -5 : 5) * stride;
    return lifting
      ? {
          [`leg${forward}`]: [-6 * stride, 0, 0],
          [`shin${forward}`]: [6, 0, 0],
          [`foot${forward}`]: ZERO,
          [`leg${back}`]: [-8 * stride, 0, 0],
          [`shin${back}`]: [58 * stride, 0, 0],
          [`foot${back}`]: [-20 * stride, 0, 0],
          lift: 0.012,
        }
      : {
          [`leg${forward}`]: [-28 * stride, 0, 0],
          [`shin${forward}`]: [8, 0, 0],
          [`foot${forward}`]: [14 * stride, 0, 0],
          [`leg${back}`]: [22 * stride, 0, 0],
          [`shin${back}`]: [20 * stride, 0, 0],
          [`foot${back}`]: [-30 * stride, 0, 0],
          chest: add(stance.chest, [3, twist, 0]),
          drop: 0.025,
        };
  };
  const flinch: Pose = {
    spine: [-15, 0, 0],
    chest: [-11, 0, 0],
    head: [-16, 0, 0],
    armL: add(stance.armL, [14, 0, 26]),
    armR: add(stance.armR, [14, 0, -26]),
    drop: 0.05,
  };
  const limp: Pose = {
    armL: [-30, 0, 62],
    foreL: [-20, 0, 0],
    armR: [-30, 0, -62],
    foreR: [-20, 0, 0],
    legL: [-12, 0, 6],
    shinL: [18, 0, 0],
    legR: [-4, 0, -8],
    shinR: [10, 0, 0],
    footL: ZERO,
    footR: ZERO,
    spine: [-6, 0, 0],
    chest: [-4, 0, 0],
    head: [-18, 0, 12],
    drop: 0,
  };
  return {
    idle: makeClip('idle', stance, [rest, { at: 0.5, pose: sway }, end]),
    walk: makeClip('walk', stance, [
      { at: 0, pose: step('L', false) },
      { at: 0.25, pose: step('L', true) },
      { at: 0.5, pose: step('R', false) },
      { at: 0.75, pose: step('R', true) },
      { at: 1, pose: step('L', false) },
    ]),
    guard: makeClip('guard', stance, [
      { at: 0, pose: moves.guard },
      { at: 1, pose: moves.guard },
    ]),
    attack: makeClip('attack', stance, [rest, ...facingEnemy(moves.attack), end]),
    special: makeClip('special', stance, [
      rest,
      ...facingEnemy(moves.special.length ? moves.special : moves.attack),
      end,
    ]),
    hit: makeClip('hit', stance, [rest, { at: 0.28, ease: 'out', pose: flinch }, end]),
    death: makeClip('death', stance, [
      rest,
      { at: 0.25, ease: 'out', pose: flinch },
      { at: 0.75, ease: 'in', pose: { ...limp, root: [-78, 0, 0], lift: -0.72 } },
      { at: 1, ease: 'out', pose: { ...limp, root: [-90, 0, 0], lift: -0.74 } },
    ]),
  };
}

function facingEnemy(keys: readonly Key[]): Key[] {
  return keys.map((key) => ({ ...key, pose: { root: ACTION_TURN, ...key.pose } }));
}

function add(base: V3 = ZERO, delta: V3): V3 {
  return [base[0] + delta[0], base[1] + delta[1], base[2] + delta[2]];
}

// ---------------------------------------------------------------------------
// Runtime

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

export function createCharacterKit(reducedMotion: boolean): CharacterKit {
  const blueprints = new Map<string, Blueprint>();
  const clips = new Map<Style, Record<ClipName, THREE.AnimationClip>>();
  const glows = new Map<number, THREE.MeshBasicMaterial>();
  // Three flat tones: the cel-shaded look.
  const gradient = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  // Inverted hull: back faces pushed out along their normals draw the ink outline.
  const ink = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, fog: false });
  ink.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n  transformed += normalize(normal) * ${OUTLINE};`,
    );
  };
  ink.customProgramCacheKey = () => 'lanes-ink';

  const blueprint = (classId: string, team: Team) => {
    const key = `${classId}:${team}`;
    let found = blueprints.get(key);
    if (!found) {
      found = build(classId, team);
      blueprints.set(key, found);
    }
    return found;
  };
  const glow = (hex: number) => {
    let material = glows.get(hex);
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color: hex, fog: false });
      glows.set(hex, material);
    }
    return material;
  };

  const create = (classId: string, team: Team, phase: number): Character => {
    const plan = blueprint(classId, team);
    let moves = clips.get(plan.style);
    if (!moves) {
      moves = makeClips(STYLES[plan.style]);
      clips.set(plan.style, moves);
    }

    const bones = new Map<BoneName, THREE.Bone>();
    for (const [name, parent, [x, y, z]] of BONES) {
      const bone = new THREE.Bone();
      bone.name = name;
      bone.position.set(x, y, z);
      if (parent) bones.get(parent)!.add(bone);
      bones.set(name, bone);
    }
    // The skeleton records its bind pose from world matrices, so compute them first.
    bones.get('root')!.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton([...bones.values()]);
    const paint = new THREE.MeshToonMaterial({
      vertexColors: true,
      gradientMap: gradient,
      fog: false,
    });
    paint.emissive.set(0xffffff);
    paint.emissiveIntensity = 0;

    const facingGroup = new THREE.Group();
    facingGroup.rotation.y = FACING_YAW;
    facingGroup.scale.setScalar(SCALE);
    for (const material of [paint, ink]) {
      const mesh = new THREE.SkinnedMesh(plan.body, material);
      if (material === paint) mesh.add(bones.get('root')!);
      mesh.bind(skeleton, new THREE.Matrix4());
      // Poses and lunges leave the bind-pose bounds, so never cull.
      mesh.frustumCulled = false;
      facingGroup.add(mesh);
    }
    const hovering: THREE.Object3D[] = [];
    for (const item of plan.attachments) {
      const holder = new THREE.Group();
      if (item.rot) holder.rotation.set(rad(item.rot[0]), rad(item.rot[1]), rad(item.rot[2]));
      holder.add(new THREE.Mesh(item.geometry, item.glow === undefined ? paint : glow(item.glow)));
      if (item.glow === undefined) holder.add(new THREE.Mesh(item.geometry, ink));
      bones.get(item.bone)!.add(holder);
      if (item.hover) hovering.push(holder);
    }
    const muzzle = new THREE.Object3D();
    muzzle.position.set(...plan.muzzle.at);
    bones.get(plan.muzzle.bone)!.add(muzzle);

    const root = new THREE.Group();
    root.add(facingGroup);
    // Enemies are mirror images, so both sides show their weapon side to the camera.
    if (team === 'enemy') root.scale.x = -1;

    const mixer = new THREE.AnimationMixer(facingGroup.children[0]);
    const actions = Object.fromEntries(
      Object.entries(moves).map(([name, clip]) => [name, mixer.clipAction(clip)]),
    ) as Record<ClipName, THREE.AnimationAction>;
    for (const name of ['attack', 'special', 'hit', 'death'] as const) {
      actions[name].setLoop(THREE.LoopOnce, 1);
      actions[name].clampWhenFinished = true;
    }
    actions.idle.setDuration(2.8);
    actions.walk.setDuration(0.62);
    actions.idle.time = phase * 2.8;
    if (reducedMotion) actions.idle.timeScale = 0;

    let base: BaseState = 'idle';
    let active = actions.idle.play();
    let dead = false;
    let spinLeft = 0;
    let spinTotal = 1;
    let clock = phase * 10;
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
      if (event.action === active && !dead) switchTo(actions[base].reset(), 0.16);
    });

    return {
      root,
      setBase(state) {
        if (dead || state === base) return;
        const wasBase = active === actions[base];
        base = state;
        if (wasBase) switchTo(actions[state].reset(), 0.18);
      },
      act(name, contact) {
        if (dead) return;
        const action = actions[name];
        action.reset().setDuration(Math.max(0.12, contact * 2));
        if (action === active) return;
        switchTo(action, Math.min(0.08, contact * 0.3));
      },
      spin(seconds) {
        if (reducedMotion) return;
        spinTotal = spinLeft = Math.max(0.1, seconds);
      },
      die() {
        if (dead) return;
        dead = true;
        switchTo(actions.death.reset().setDuration(0.8), 0.08);
      },
      flash(amount) {
        paint.emissiveIntensity = amount;
      },
      muzzle(out) {
        return muzzle.getWorldPosition(out);
      },
      update(dt) {
        mixer.update(dt);
        clock += dt;
        if (spinLeft > 0) {
          spinLeft = Math.max(0, spinLeft - dt);
          facingGroup.rotation.y = FACING_YAW + (1 - spinLeft / spinTotal) * Math.PI * 2;
        }
        if (!reducedMotion)
          for (const item of hovering) item.position.y = Math.sin(clock * 2.2) * 0.02;
      },
      dispose() {
        mixer.stopAllAction();
        paint.dispose();
        skeleton.dispose();
      },
    };
  };

  return {
    create,
    dispose() {
      for (const plan of blueprints.values()) {
        plan.body.dispose();
        for (const item of plan.attachments) item.geometry.dispose();
      }
      for (const material of glows.values()) material.dispose();
      gradient.dispose();
      ink.dispose();
    },
  };
}
