import * as THREE from 'three';
import type { CameraDirector } from './stage-camera';
import { ease, type Effects } from './stage-effects';
import { FIELD_WIDTH } from './stage-layout';
import type { Particles } from './stage-particles';
import type { StageAction, StageContext, StageState } from './stage-types';
import { facing, type Units, type UnitView } from './stage-units';

// Skill presentation

type Delivery =
  | 'melee'
  | 'lunge'
  | 'spin'
  | 'shout'
  | 'arrow'
  | 'volley'
  | 'bullet'
  | 'snipe'
  | 'bolt'
  | 'meteor'
  | 'wave'
  | 'pillar'
  | 'blessing'
  | 'buff';

interface SkillLook {
  readonly delivery: Delivery;
  readonly color: number;
  readonly burst?: 'explosion';
}

const LOOKS: Record<string, SkillLook> = {
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
  explosive_shot: { delivery: 'bullet', color: 0xff9f43, burst: 'explosion' },
};

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
  const {
    later,
    tween,
    transient,
    glowSprite,
    shockwave,
    lightColumn,
    slashAt,
    projectile,
    explode,
  } = effects;
  const { spawn, burst } = particles;
  const scratch = new THREE.Vector3();

  const hit = (
    attacker: UnitView,
    target: UnitView,
    effect: StageAction['effects'][number],
    look: SkillLook,
    scale: number,
  ) => {
    const at = chest(target);
    if (effect.isHealing) {
      for (let i = 0; i < 18; i++) {
        spawn(
          scratch.set(at.x + (random() - 0.5) * 1.1, random() * 0.6, at.z + (random() - 0.5) * 0.4),
          new THREE.Vector3(0, 1.2 + random() * 1.2, 0),
          look.color,
          0.3 + random() * 0.25,
          0.8 + random() * 0.5,
        );
      }
      shockwave(target.group.position, look.color, 1.4, 0.6 * scale);
      return;
    }
    target.flash = 0.7;
    target.character.act('hit', 0.11);
    const away =
      Math.sign(target.group.position.x - attacker.group.position.x) || -facing(target.team);
    target.knock = away * (effect.wasDefeated ? 0.55 : 0.28);
    burst(at, look.color, 16, 3.2);
    if (effect.guardAbsorbed > 0) {
      target.shield.visible = true;
      target.shield.material.opacity = 1;
      burst(target.shield.getWorldPosition(new THREE.Vector3()), 0x9fd4ff, 12, 2.4, 0.3);
    }
    if (look.burst === 'explosion') explode(at, look.color, 0.7);
    director.addShake(0.06);
    if (effect.wasDefeated) later(0.25 * scale, () => (target.dying = 0));
  };

  const play = (action: StageAction) => {
    const attacker = views.get(action.attackerId);
    const state = getState();
    if (!attacker || !state) return;
    const look = LOOKS[action.abilityId] ?? { delivery: 'melee', color: 0xffffff };
    const scale = state.speed;
    const impact = state.impactDelay;
    const targets = action.effects
      .map((effect) => ({ effect, view: views.get(effect.targetId) }))
      .filter(
        (entry): entry is { effect: StageAction['effects'][number]; view: UnitView } =>
          !!entry.view,
      );
    const first = targets[0]?.view;
    const dir = facing(attacker.team);
    const origin = attacker.group.position.clone();
    const land = () =>
      targets.forEach(({ effect, view }) => hit(attacker, view, effect, look, scale));

    if (first && !reducedMotion) {
      tween(impact + 0.35 * scale, (k) => director.addPunch(Math.sin(Math.PI * k) * 0.025));
    }

    // Each clip is timed so its key moment (strike, release) matches the effects below.
    const release = impact * 0.5;
    switch (look.delivery) {
      case 'melee':
      case 'lunge':
      case 'pillar':
        attacker.character.act('attack', impact);
        break;
      case 'arrow':
      case 'bullet':
      case 'snipe':
      case 'bolt':
        attacker.character.act('attack', release);
        break;
      case 'volley':
        attacker.character.act('special', impact * 0.3);
        break;
      default:
        attacker.character.act('special', impact * 0.8);
    }

    switch (look.delivery) {
      case 'melee':
      case 'lunge': {
        if (!first) break;
        const goal = first.group.position.clone();
        goal.x -= Math.sign(goal.x - origin.x || dir) * 1.05;
        if (look.delivery === 'melee') goal.z = origin.z;
        const reach = goal.sub(origin);
        tween(impact, (k) => attacker.offset.copy(reach).multiplyScalar(ease(k)));
        later(impact, () => {
          slashAt(chest(first), look.color, dir);
          land();
          tween(0.3 * scale, (k) => attacker.offset.copy(reach).multiplyScalar(1 - ease(k)));
        });
        if (look.delivery === 'lunge')
          later(0.05 * scale, () => burst(chest(attacker), look.color, 10, 1.5, 0.25));
        break;
      }
      case 'spin':
      case 'shout':
        if (look.delivery === 'spin') attacker.character.spin(impact * 1.3);
        later(impact * 0.5, () => {
          shockwave(origin, look.color, FIELD_WIDTH * 0.55, 0.55 * scale);
          if (look.delivery === 'shout') burst(chest(attacker), look.color, 18, 2, 0.35);
        });
        later(impact, land);
        break;
      case 'arrow':
      case 'bullet':
      case 'snipe':
      case 'bolt':
        later(release, () => {
          attacker.knock = -dir * 0.12;
          burst(hand(attacker), look.color, look.delivery === 'bolt' ? 12 : 6, 1.4, 0.3);
        });
        for (const { view } of targets.slice(0, look.burst ? 1 : targets.length)) {
          const flight = look.delivery === 'snipe' ? 0.08 : impact - release;
          later(impact - flight, () =>
            projectile(
              hand(attacker),
              chest(view),
              flight,
              look.color,
              look.delivery === 'arrow' ? 'arrow' : look.delivery === 'bolt' ? 'orb' : 'bullet',
              look.delivery === 'arrow' ? 0.9 : look.delivery === 'bolt' ? 0.35 : 0,
            ),
          );
        }
        later(impact, land);
        break;
      case 'volley':
        for (const { view } of targets) {
          for (let i = 0; i < 5; i++) {
            const to = chest(view).add(
              new THREE.Vector3((random() - 0.5) * 1.2, -0.3, (random() - 0.5) * 0.5),
            );
            const from = to.clone().add(new THREE.Vector3(-dir * 3.2, 6, 0));
            later(impact * 0.25 + i * 0.03, () =>
              projectile(from, to, impact * 0.75 - 0.12, 0xffffff, 'arrow', 0),
            );
          }
        }
        later(impact, land);
        break;
      case 'wave': {
        const distance = first ? first.group.position.x - origin.x : dir * 6;
        for (let i = 1; i <= 7; i++) {
          later((impact * i) / 8, () =>
            burst(
              origin.clone().add(new THREE.Vector3((distance * i) / 7, 0.4, 0)),
              look.color,
              8,
              2.2,
              0.55,
            ),
          );
        }
        later(impact, () => {
          targets.forEach(({ view }) => explode(chest(view), look.color, 0.45));
          land();
        });
        break;
      }
      case 'meteor': {
        const centre = new THREE.Vector3();
        targets.forEach(({ view }) => centre.add(view.group.position));
        if (targets.length) centre.divideScalar(targets.length);
        const rock = glowSprite(look.color, 2.2);
        const from = centre.clone().add(new THREE.Vector3(-dir * 7, 14, -4));
        transient(rock, impact, (k) => {
          rock.position.lerpVectors(from, centre, k * k);
          spawn(rock.position, scratch.set(0, 0.5, 0), 0xffb347, 0.9, 0.4, 0, 0.8);
        });
        later(impact, () => {
          explode(centre, look.color, 1.8);
          land();
        });
        break;
      }
      case 'pillar':
        later(impact * 0.6, () => burst(hand(attacker), look.color, 10, 1.2, 0.3));
        for (const { view } of targets)
          later(impact * 0.4, () => lightColumn(view.group.position, look.color, 0.75 * scale));
        later(impact, land);
        break;
      case 'blessing':
        burst(chest(attacker), look.color, 20, 1.8, 0.35);
        later(impact, land);
        break;
      case 'buff':
        later(impact * 0.5, () => {
          lightColumn(origin, look.color, 0.6 * scale);
          shockwave(origin, look.color, 1.6, 0.5 * scale);
        });
        break;
    }
  };

  return { play };
}
