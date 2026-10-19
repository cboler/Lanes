import type { ProjectileKind } from './stage-effects';
import { FIELD_WIDTH } from './stage-layout';

/*
 * How each skill looks on the stage, as data. A skill picks a delivery and a colour;
 * a delivery is a recipe: how the attacker's clip is timed, then a list of timed steps
 * built from a handful of primitives. The interpreter lives in stage-choreography.ts.
 * Adding a skill is one LOOKS entry; a new delivery is a new recipe, not new code,
 * unless it needs a primitive that does not exist yet.
 */

/**
 * A moment or span. `impact` is a fraction of the delay before hits land; `seconds`
 * are at normal speed and stretch with playback speed. The two add up.
 */
export interface Time {
  readonly impact?: number;
  readonly seconds?: number;
}

/** Hits land: damage, healing, flinches and knockback on every target. */
const IMPACT: Time = { impact: 1 };

interface Timed {
  /** When the step starts; the moment the action begins if left out. */
  readonly at?: Time;
}

export type Step = Timed &
  (
    | {
        /** The attacker runs up to the first target. */
        readonly do: 'approach';
        readonly keepLane: boolean;
        readonly duration: Time;
      }
    | {
        /** The attacker returns from an approach. */
        readonly do: 'retreat';
        readonly duration: Time;
      }
    | {
        /** A slash mark across the first target. */
        readonly do: 'slash';
      }
    | {
        /** The attacker spins on the spot. */
        readonly do: 'spin';
        readonly duration: Time;
      }
    | {
        /** The attacker is pushed back by the force of the shot. */
        readonly do: 'recoil';
        readonly amount: number;
      }
    | {
        readonly do: 'burst';
        readonly from: 'attacker' | 'hand';
        readonly count: number;
        readonly speed: number;
        readonly size: number;
      }
    | {
        /** An expanding ring on the ground at the attacker's feet. */
        readonly do: 'shockwave';
        readonly radius: number;
        readonly duration: Time;
      }
    | {
        readonly do: 'column';
        readonly on: 'targets' | 'attacker';
        readonly duration: Time;
      }
    | {
        /** A shot from the attacker's hand to its target(s). */
        readonly do: 'projectile';
        readonly kind: ProjectileKind;
        readonly arc: number;
        readonly duration: Time;
        readonly targets: 'each' | 'first';
      }
    | {
        /** Arrows falling from above onto every target, a short stagger apart. */
        readonly do: 'rain';
        readonly shots: number;
        readonly stagger: Time;
        readonly duration: Time;
      }
    | {
        /** Bursts at even stops along the way to the first target. */
        readonly do: 'sweep';
        readonly stops: number;
        readonly span: Time;
        readonly count: number;
        readonly speed: number;
        readonly size: number;
      }
    | {
        /** Something heavy crashing down onto the middle of the targets. */
        readonly do: 'fall';
        readonly size: number;
        readonly height: number;
        readonly behind: number;
        readonly depth: number;
        readonly trail: number;
        readonly duration: Time;
      }
    | {
        readonly do: 'explode';
        readonly on: 'targets' | 'centroid';
        readonly size: number;
      }
    | {
        readonly do: 'land';
      }
  );

export interface Recipe {
  /** The attacker's clip, timed so its key frame (the strike or release) lands `key` × impact in. */
  readonly clip: { readonly action: 'attack' | 'special'; readonly key: number };
  readonly steps: readonly Step[];
}

// ---------------------------------------------------------------------------
// Recipes

/** Melee: the attacker closes in, strikes on impact, then falls back. */
const melee = (keepLane: boolean, extra: readonly Step[] = []): Recipe => ({
  clip: { action: 'attack', key: 1 },
  steps: [
    { do: 'approach', keepLane, duration: IMPACT },
    { at: IMPACT, do: 'slash' },
    { at: IMPACT, do: 'land' },
    { at: IMPACT, do: 'retreat', duration: { seconds: 0.3 } },
    ...extra,
  ],
});

/** The moment a span of `time` before impact begins. */
const before = (time: Time): Time => ({
  impact: 1 - (time.impact ?? 0),
  seconds: time.seconds ? -time.seconds : 0,
});

/** A shot released halfway to impact; `flight` is how long it travels. */
const ranged = (options: {
  readonly kind: ProjectileKind;
  readonly arc: number;
  readonly flight: Time;
  readonly muzzle: number;
  readonly targets?: 'each' | 'first';
}): Recipe => {
  const { kind, arc, flight, muzzle, targets = 'each' } = options;
  const release: Time = { impact: 0.5 };
  return {
    clip: { action: 'attack', key: 0.5 },
    steps: [
      { at: release, do: 'recoil', amount: 0.12 },
      { at: release, do: 'burst', from: 'hand', count: muzzle, speed: 1.4, size: 0.3 },
      {
        at: before(flight),
        do: 'projectile',
        kind,
        arc,
        duration: flight,
        targets,
      },
      { at: IMPACT, do: 'land' },
    ],
  };
};

/** A shout or spin: a shockwave rolls out and everyone in reach is hit. */
const shockwave = (extra: readonly Step[]): Recipe => ({
  clip: { action: 'special', key: 0.8 },
  steps: [
    ...extra,
    {
      at: { impact: 0.5 },
      do: 'shockwave',
      radius: FIELD_WIDTH * 0.55,
      duration: { seconds: 0.55 },
    },
    { at: IMPACT, do: 'land' },
  ],
});

export const RECIPES = {
  melee: melee(true),
  lunge: melee(false, [
    { at: { seconds: 0.05 }, do: 'burst', from: 'attacker', count: 10, speed: 1.5, size: 0.25 },
  ]),
  spin: shockwave([{ do: 'spin', duration: { impact: 1.3 } }]),
  shout: shockwave([
    { at: { impact: 0.5 }, do: 'burst', from: 'attacker', count: 18, speed: 2, size: 0.35 },
  ]),
  arrow: ranged({ kind: 'arrow', arc: 0.9, flight: { impact: 0.5 }, muzzle: 6 }),
  bullet: ranged({ kind: 'bullet', arc: 0, flight: { impact: 0.5 }, muzzle: 6 }),
  /** One shell for the whole lane; each target then explodes on impact. */
  shell: ranged({ kind: 'bullet', arc: 0, flight: { impact: 0.5 }, muzzle: 6, targets: 'first' }),
  snipe: ranged({ kind: 'bullet', arc: 0, flight: { seconds: 0.08 }, muzzle: 6 }),
  bolt: ranged({ kind: 'orb', arc: 0.35, flight: { impact: 0.5 }, muzzle: 12 }),
  volley: {
    clip: { action: 'special', key: 0.3 },
    steps: [
      {
        at: { impact: 0.25 },
        do: 'rain',
        shots: 5,
        stagger: { seconds: 0.03 },
        duration: { impact: 0.75, seconds: -0.12 },
      },
      { at: IMPACT, do: 'land' },
    ],
  },
  wave: {
    clip: { action: 'special', key: 0.8 },
    steps: [
      { do: 'sweep', stops: 7, span: IMPACT, count: 8, speed: 2.2, size: 0.55 },
      { at: IMPACT, do: 'explode', on: 'targets', size: 0.45 },
      { at: IMPACT, do: 'land' },
    ],
  },
  meteor: {
    clip: { action: 'special', key: 0.8 },
    steps: [
      {
        do: 'fall',
        size: 2.2,
        height: 14,
        behind: 7,
        depth: -4,
        trail: 0xffb347,
        duration: IMPACT,
      },
      { at: IMPACT, do: 'explode', on: 'centroid', size: 1.8 },
      { at: IMPACT, do: 'land' },
    ],
  },
  pillar: {
    clip: { action: 'attack', key: 1 },
    steps: [
      { at: { impact: 0.4 }, do: 'column', on: 'targets', duration: { seconds: 0.75 } },
      { at: { impact: 0.6 }, do: 'burst', from: 'hand', count: 10, speed: 1.2, size: 0.3 },
      { at: IMPACT, do: 'land' },
    ],
  },
  blessing: {
    clip: { action: 'special', key: 0.8 },
    steps: [
      { do: 'burst', from: 'attacker', count: 20, speed: 1.8, size: 0.35 },
      { at: IMPACT, do: 'land' },
    ],
  },
  buff: {
    clip: { action: 'special', key: 0.8 },
    steps: [
      { at: { impact: 0.5 }, do: 'column', on: 'attacker', duration: { seconds: 0.6 } },
      { at: { impact: 0.5 }, do: 'shockwave', radius: 1.6, duration: { seconds: 0.5 } },
    ],
  },
} satisfies Record<string, Recipe>;

export type Delivery = keyof typeof RECIPES;

// ---------------------------------------------------------------------------
// Skills

export interface SkillLook {
  readonly delivery: Delivery;
  readonly color: number;
  /** Every target also detonates on impact. */
  readonly burst?: 'explosion';
}

export const LOOKS: Record<string, SkillLook> = {
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
  explosive_shot: { delivery: 'shell', color: 0xff9f43, burst: 'explosion' },
  // Advanced skills, learned by skill pattern.
  shield_charge: { delivery: 'lunge', color: 0xffd36a },
  rally: { delivery: 'blessing', color: 0xffb347 },
  crushing_blow: { delivery: 'melee', color: 0xff7a45 },
  renew: { delivery: 'pillar', color: 0x7dffb2 },
  sanctuary: { delivery: 'blessing', color: 0x9fd4ff },
  judgement: { delivery: 'pillar', color: 0xffe08a },
  poison_arrow: { delivery: 'arrow', color: 0x9be564 },
  pinning_shot: { delivery: 'arrow', color: 0xc4b5fd },
  arrow_storm: { delivery: 'volley', color: 0xfff2c4 },
  frost_lance: { delivery: 'bolt', color: 0x8fe8ff },
  hex: { delivery: 'bolt', color: 0xb57bff },
  thunderstorm: { delivery: 'pillar', color: 0xc8e6ff },
  impale: { delivery: 'melee', color: 0x8fd3ff },
  skewer: { delivery: 'lunge', color: 0xbfe6ff },
  battle_trance: { delivery: 'buff', color: 0xff6a6a },
  armor_piercer: { delivery: 'snipe', color: 0xffb347 },
  scatter_shot: { delivery: 'bullet', color: 0xffd36a },
  flashbang: { delivery: 'shell', color: 0xffffff, burst: 'explosion' },
};

/** What an unlisted skill gets. */
export const DEFAULT_LOOK: SkillLook = { delivery: 'melee', color: 0xffffff };
