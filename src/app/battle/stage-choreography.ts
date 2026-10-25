import * as THREE from 'three';
import type { CameraDirector } from './stage-camera';
import { ease, type Effects } from './stage-effects';
import {
  DEFAULT_LOOK,
  LOOKS,
  RECIPES,
  type Recipe,
  type SkillLook,
  type Step,
  type Time,
} from './stage-looks';
import type { Particles } from './stage-particles';
import type { StageAction, StageContext, StageState } from './stage-types';
import { facing, type Units, type UnitView } from './stage-units';

interface Target {
  readonly effect: StageAction['effects'][number];
  readonly view: UnitView;
}

/** What a step needs to know about the action being played. */
interface Play {
  readonly attacker: UnitView;
  readonly targets: readonly Target[];
  readonly first: UnitView | undefined;
  readonly look: SkillLook;
  /** Where the attacker stood when the action began. */
  readonly origin: THREE.Vector3;
  /** 1 for a unit facing right (player), -1 for an enemy. */
  readonly dir: number;
  /** Playback speed: 1 normally, smaller when faster. */
  readonly speed: number;
  /** Seconds until the hits land. */
  readonly impact: number;
  /** How far an approach moved the attacker, so a retreat can undo it. */
  reach: THREE.Vector3 | null;
  /** The middle of the targets, found the first time a step needs it. */
  centre: THREE.Vector3 | null;
}

const seconds = (play: Play, time: Time = {}): number =>
  (time.impact ?? 0) * play.impact + (time.seconds ?? 0) * play.speed;

export interface Choreography {
  /** Replays a resolved action: the attacker's clip, effects and each target's reaction. */
  play(action: StageAction): void;
}

export function createChoreography(
  { random, reducedMotion }: StageContext,
  units: Units,
  particles: Particles,
  effects: Effects,
  director: CameraDirector,
  getState: () => StageState | null,
): Choreography {
  const { views, chest, hand } = units;
  const scratch = new THREE.Vector3();
  /** The action that last moved each attacker; an older retreat yields to a newer approach. */
  const movers = new WeakMap<UnitView, Play>();

  /** Runs now when there is no delay, so steps at the same moment keep their listed order. */
  const after = (delay: number, run: () => void) => (delay > 0 ? effects.later(delay, run) : run());

  const centroid = (play: Play) => {
    if (!play.centre) {
      play.centre = new THREE.Vector3();
      for (const { view } of play.targets) play.centre.add(view.group.position);
      if (play.targets.length) play.centre.divideScalar(play.targets.length);
    }
    return play.centre;
  };

  /** A target's reaction when an action lands on it. */
  const hit = (
    attacker: UnitView,
    target: UnitView,
    effect: StageAction['effects'][number],
    look: SkillLook,
    speed: number,
  ) => {
    const at = chest(target);
    if (effect.missed) {
      const away = facing(attacker.team) * 0.9;
      particles.burst(
        scratch.set(target.group.position.x + away, 0.15, target.group.position.z),
        0xb59a72,
        12,
        1.6,
        0.3,
      );
      return;
    }
    if (effect.isHealing || effect.isBuff) {
      for (let i = 0; i < 18; i++) {
        particles.spawn(
          scratch.set(at.x + (random() - 0.5) * 1.1, random() * 0.6, at.z + (random() - 0.5) * 0.4),
          new THREE.Vector3(0, 1.2 + random() * 1.2, 0),
          look.color,
          0.3 + random() * 0.25,
          0.8 + random() * 0.5,
        );
      }
      effects.shockwave(target.group.position, look.color, 1.4, 0.6 * speed);
      return;
    }
    // A shield that takes the blow flares, throws sparks, and keeps its bearer on its feet.
    const raise = (bearer: UnitView) => {
      bearer.shield.visible = true;
      bearer.shield.material.opacity = 1;
      const rim = bearer.shield.getWorldPosition(new THREE.Vector3());
      particles.burst(rim, 0xfff1c0, 14, 3, 0.25);
      effects.shockwave(rim, 0xcfe6ff, 0.7, 0.25 * speed);
    };
    const braced = !!effect.blocked && !effect.wasDefeated;
    target.flash = braced ? 0.3 : 0.7;
    target.character.act('hit', braced ? 0.05 : 0.11);
    const away =
      Math.sign(target.group.position.x - attacker.group.position.x) || -facing(target.team);
    target.knock = away * (effect.wasDefeated ? 0.55 : braced ? 0.1 : 0.28);
    particles.burst(at, look.color, braced ? 6 : 16, 3.2);
    if (effect.blocked) raise(target);
    const cover = effect.coveredBy ? views.get(effect.coveredBy) : undefined;
    if (cover) raise(cover);
    if (effect.guardAbsorbed > 0) {
      target.shield.visible = true;
      target.shield.material.opacity = 1;
      particles.burst(target.shield.getWorldPosition(new THREE.Vector3()), 0x9fd4ff, 12, 2.4, 0.3);
    }
    if (look.burst === 'explosion') effects.explode(at, look.color, 0.7);
    director.addShake(0.06);
    if (effect.wasDefeated) effects.later(0.25 * speed, () => (target.dying = 0));
  };

  // The steps a recipe is built from. Each is told when to start, in seconds from the
  // action's beginning, and does the work then.
  const handlers: {
    [K in Step['do']]: (step: Extract<Step, { do: K }>, play: Play, delay: number) => void;
  } = {
    approach: (step, play, delay) =>
      after(delay, () => {
        const { attacker, first, origin, dir } = play;
        if (!first) return;
        const goal = first.group.position.clone();
        goal.x -= Math.sign(goal.x - origin.x || dir) * 1.05;
        if (step.keepLane) goal.z = origin.z;
        const reach = goal.sub(origin);
        play.reach = reach;
        // A chained attack starts from wherever the last one left the attacker.
        const from = attacker.offset.clone();
        movers.set(attacker, play);
        effects.tween(seconds(play, step.duration), (k) => {
          if (movers.get(attacker) === play) attacker.offset.lerpVectors(from, reach, ease(k));
        });
      }),

    retreat: (step, play, delay) =>
      after(delay, () => {
        const { attacker, reach } = play;
        if (!reach) return;
        effects.tween(seconds(play, step.duration), (k) => {
          if (movers.get(attacker) === play)
            attacker.offset.copy(reach).multiplyScalar(1 - ease(k));
        });
      }),

    slash: (_step, play, delay) =>
      after(delay, () => {
        if (play.first) effects.slashAt(chest(play.first), play.look.color, play.dir);
      }),

    spin: (step, play, delay) =>
      after(delay, () => play.attacker.character.spin(seconds(play, step.duration))),

    recoil: (step, play, delay) =>
      after(delay, () => (play.attacker.knock = -play.dir * step.amount)),

    burst: (step, play, delay) =>
      after(delay, () =>
        particles.burst(
          step.from === 'hand' ? hand(play.attacker) : chest(play.attacker),
          play.look.color,
          step.count,
          step.speed,
          step.size,
        ),
      ),

    shockwave: (step, play, delay) =>
      after(delay, () =>
        effects.shockwave(play.origin, play.look.color, step.radius, seconds(play, step.duration)),
      ),

    column: (step, play, delay) =>
      after(delay, () => {
        const duration = seconds(play, step.duration);
        if (step.on === 'attacker') {
          effects.lightColumn(play.origin, play.look.color, duration);
          return;
        }
        for (const { view } of play.targets) {
          effects.lightColumn(view.group.position, play.look.color, duration);
        }
      }),

    projectile: (step, play, delay) =>
      after(delay, () => {
        const shots = step.targets === 'first' ? play.targets.slice(0, 1) : play.targets;
        for (const { view, effect } of shots) {
          const to = chest(view);
          // A miss sails past and lands in the dirt behind the target.
          if (effect.missed) to.set(to.x + play.dir * 0.9, 0.15, to.z);
          effects.projectile(
            hand(play.attacker),
            to,
            seconds(play, step.duration),
            play.look.color,
            step.kind,
            step.arc,
          );
        }
      }),

    rain: (step, play, delay) => {
      // Where each arrow lands is decided now; only its release is delayed.
      const flight = seconds(play, step.duration);
      const stagger = seconds(play, step.stagger);
      for (const { view } of play.targets) {
        for (let i = 0; i < step.shots; i++) {
          const to = chest(view).add(
            new THREE.Vector3((random() - 0.5) * 1.2, -0.3, (random() - 0.5) * 0.5),
          );
          const from = to.clone().add(new THREE.Vector3(-play.dir * 3.2, 6, 0));
          after(delay + stagger * i, () =>
            effects.projectile(from, to, flight, 0xffffff, 'arrow', 0),
          );
        }
      }
    },

    sweep: (step, play, delay) => {
      const { first, origin, dir, look } = play;
      const distance = first ? first.group.position.x - origin.x : dir * 6;
      const span = seconds(play, step.span);
      for (let i = 1; i <= step.stops; i++) {
        after(delay + (span * i) / (step.stops + 1), () =>
          particles.burst(
            origin.clone().add(new THREE.Vector3((distance * i) / step.stops, 0.4, 0)),
            look.color,
            step.count,
            step.speed,
            step.size,
          ),
        );
      }
    },

    fall: (step, play, delay) =>
      after(delay, () => {
        const centre = centroid(play);
        const rock = effects.glowSprite(play.look.color, step.size);
        const from = centre
          .clone()
          .add(new THREE.Vector3(-play.dir * step.behind, step.height, step.depth));
        effects.transient(rock, seconds(play, step.duration), (k) => {
          rock.position.lerpVectors(from, centre, k * k);
          particles.spawn(rock.position, scratch.set(0, 0.5, 0), step.trail, 0.9, 0.4, 0, 0.8);
        });
      }),

    explode: (step, play, delay) =>
      after(delay, () => {
        if (step.on === 'centroid') {
          effects.explode(centroid(play), play.look.color, step.size);
          return;
        }
        for (const { view } of play.targets) {
          effects.explode(chest(view), play.look.color, step.size);
        }
      }),

    land: (_step, play, delay) =>
      after(delay, () => {
        for (const { effect, view } of play.targets) {
          hit(play.attacker, view, effect, play.look, play.speed);
        }
      }),
  };

  const play = (action: StageAction) => {
    const attacker = views.get(action.attackerId);
    const state = getState();
    if (!attacker || !state) return;
    const look = LOOKS[action.abilityId] ?? DEFAULT_LOOK;
    const recipe: Recipe = RECIPES[look.delivery];
    const targets = action.effects
      .map((effect) => ({ effect, view: views.get(effect.targetId) }))
      .filter((entry): entry is Target => !!entry.view);
    const current: Play = {
      attacker,
      targets,
      first: targets[0]?.view,
      look,
      origin: attacker.group.position.clone(),
      dir: facing(attacker.team),
      speed: state.speed,
      impact: state.impactDelay,
      reach: null,
      centre: null,
    };

    if (current.first && !reducedMotion) {
      effects.tween(current.impact + 0.35 * current.speed, (k) =>
        director.addPunch(Math.sin(Math.PI * k) * 0.025),
      );
    }

    // The clip is timed so its key moment (strike, release) matches the steps below.
    attacker.character.act(recipe.clip.action, current.impact * recipe.clip.key);
    for (const step of recipe.steps) {
      const run = handlers[step.do] as (step: Step, play: Play, delay: number) => void;
      run(step, current, seconds(current, step.at));
    }
  };

  return { play };
}
