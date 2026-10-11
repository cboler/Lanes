import { Group, Sprite, SpriteMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { seededRandom } from '../core/models/mercenary.model';
import type { CameraDirector } from './stage-camera';
import { createChoreography } from './stage-choreography';
import type { Effects } from './stage-effects';
import type { Particles } from './stage-particles';
import type { StageAction, StageContext, StageState } from './stage-types';
import type { Units, UnitView } from './stage-units';

interface Entry {
  readonly t: number;
  readonly what: string;
  readonly args: readonly unknown[];
}

/**
 * Plays one action against a recording stage and a fake clock: attacker "a" faces
 * `targets` units, or `healing` allies, and the log says what happened when.
 */
function play(
  abilityId: string,
  options: { targets?: number; healing?: boolean; speed?: number; team?: 'player' | 'enemy' } = {},
) {
  const { targets = 1, healing = false, speed = 1, team = 'player' } = options;
  const impact = 0.42 * speed;
  let now = 0;
  let order = 0;
  const queue: { at: number; order: number; run: () => void }[] = [];
  const log: Entry[] = [];
  const note = (what: string, ...args: unknown[]) => log.push({ t: now, what, args });
  const schedule = (at: number, run: () => void) => queue.push({ at, order: order++, run });

  const effects = {
    later: (delay: number, run: () => void) => schedule(now + delay, run),
    tween: (duration: number, update: (k: number) => void, done?: () => void) => {
      note('tween', duration);
      schedule(now + duration, () => {
        update(1);
        done?.();
      });
    },
    transient: (_object: unknown, duration: number, update: (k: number) => void) => {
      note('transient', duration);
      schedule(now + duration, () => update(1));
    },
    glowSprite: () => new Sprite(new SpriteMaterial()),
    shockwave: (...args: unknown[]) => note('shockwave', ...args),
    lightColumn: (...args: unknown[]) => note('column', ...args),
    slashAt: (...args: unknown[]) => note('slash', ...args),
    projectile: (...args: unknown[]) => note('projectile', ...args),
    explode: (...args: unknown[]) => note('explode', ...args),
  } as unknown as Effects;
  const particles = {
    spawn: () => undefined,
    burst: (...args: unknown[]) => note('burst', ...args),
  } as unknown as Particles;
  const director = {
    addShake: () => undefined,
    addPunch: () => undefined,
  } as unknown as CameraDirector;

  const makeView = (id: string, side: 'player' | 'enemy', x: number, z: number): UnitView => {
    const group = new Group();
    group.position.set(x, 0, z);
    const shield = new Sprite(new SpriteMaterial());
    shield.visible = false;
    return {
      id,
      team: side,
      group,
      character: {
        act: (name: string, contact: number) => note('act', id, name, contact),
        spin: (seconds: number) => note('spin', id, seconds),
        muzzle: (out: Vector3) => out.set(group.position.x + 0.5, 1.2, group.position.z),
      },
      flash: 0,
      shield,
      offset: new Vector3(),
      knock: 0,
      dying: -1,
    } as unknown as UnitView;
  };

  const attackerX = team === 'player' ? -4 : 4;
  const views = new Map<string, UnitView>();
  const attacker = makeView('a', team, attackerX, 0);
  views.set('a', attacker);
  const foe = team === 'player' ? 'enemy' : 'player';
  const effectList: StageAction['effects'][number][] = [];
  for (let i = 0; i < targets; i++) {
    const side = healing ? team : foe;
    views.set(
      `t${i}`,
      makeView(`t${i}`, side, healing ? attackerX + 1 + i : -attackerX, i * 3.2 - 3.2),
    );
    effectList.push({
      targetId: `t${i}`,
      isHealing: healing,
      guardAbsorbed: 0,
      wasDefeated: false,
    });
  }

  const units = {
    views,
    chest: (view: UnitView, out = new Vector3()) => out.copy(view.group.position).setY(1.045),
    hand: (view: UnitView) => view.character.muzzle(new Vector3()),
  } as unknown as Units;
  const state = { speed, impactDelay: impact } as StageState;
  const ctx = { random: seededRandom(11), reducedMotion: false } as unknown as StageContext;
  createChoreography(ctx, units, particles, effects, director, () => state).play({
    attackerId: 'a',
    abilityId,
    effects: effectList,
  });

  while (queue.length) {
    queue.sort((a, b) => a.at - b.at || a.order - b.order);
    const next = queue.shift()!;
    now = next.at;
    next.run();
  }
  const of = (what: string) => log.filter((entry) => entry.what === what);
  return { log, of, impact, attacker, views };
}

/** The knockback a hit leaves on a target; zero until the action lands. */
const struck = (views: Map<string, UnitView>) =>
  [...views.values()].filter((view) => view.id !== 'a' && view.knock !== 0);

describe('stage choreography', () => {
  it('times the attacker clip so its key frame lands with the effects', () => {
    const { of, impact } = play('shield_bash');
    expect(of('act')[0].args).toEqual(['a', 'attack', impact]);
    const shot = play('quick_shot');
    expect(shot.of('act')[0].args).toEqual(['a', 'attack', shot.impact * 0.5]);
    const spell = play('meteor');
    expect(spell.of('act')[0].args).toEqual(['a', 'special', spell.impact * 0.8]);
  });

  it('runs a melee skill in, strikes on impact, then falls back', () => {
    const { of, impact, attacker, views } = play('shield_bash');
    // The run-up takes the whole impact delay (beside the camera punch), then the slash.
    const durations = of('tween').map((entry) => entry.args[0]);
    expect(of('tween').find((entry) => entry.args[0] === impact)?.t).toBe(0);
    expect(durations).toContain(0.3);
    expect(of('slash')[0].t).toBeCloseTo(impact);
    expect(struck(views)).toHaveLength(1);
    expect(attacker.offset.length()).toBeCloseTo(0);
  });

  it('shoots an arrow at release and lands it at impact', () => {
    const { of, impact } = play('quick_shot');
    expect(of('projectile')).toHaveLength(1);
    expect(of('projectile')[0].t).toBeCloseTo(impact * 0.5);
    expect(of('projectile')[0].args[2]).toBeCloseTo(impact * 0.5);
    expect(of('projectile')[0].args[4]).toBe('arrow');
  });

  it('rains five arrows on every target for a volley', () => {
    const { of } = play('volley', { targets: 3 });
    expect(of('projectile')).toHaveLength(15);
  });

  it('fires one shell for the whole lane, then every target explodes', () => {
    const { of } = play('explosive_shot', { targets: 3 });
    expect(of('projectile')).toHaveLength(1);
    expect(of('explode')).toHaveLength(3);
  });

  it('drops a meteor and blows it up on the middle of the targets', () => {
    const { of, impact } = play('meteor', { targets: 3 });
    expect(of('transient')[0]).toMatchObject({ t: 0, args: [impact] });
    const big = of('explode').find((entry) => entry.args[2] === 1.8);
    expect(big?.t).toBeCloseTo(impact);
    expect((big?.args[0] as Vector3).z).toBeCloseTo(0);
  });

  it('heals with columns and sparkles instead of hits', () => {
    const { of, views } = play('mend', { healing: true });
    expect(of('column')).toHaveLength(1);
    expect(of('shockwave')).toHaveLength(1);
    expect(struck(views)).toHaveLength(0);
  });

  it('buffs without touching any target', () => {
    const { of, views } = play('bulwark', { targets: 0 });
    expect(of('column')).toHaveLength(1);
    expect(of('shockwave')).toHaveLength(1);
    expect(struck(views)).toHaveLength(0);
  });

  it('falls back to a plain melee look for a skill nobody styled', () => {
    const { of } = play('mystery_skill');
    expect(of('slash')).toHaveLength(1);
  });

  it('plays an action with no targets left without error', () => {
    for (const id of ['shield_bash', 'volley', 'meteor', 'inferno', 'snipe']) {
      expect(() => play(id, { targets: 0 })).not.toThrow();
    }
  });

  it('stretches every time with playback speed', () => {
    const normal = play('piercing_arrow');
    const fast = play('piercing_arrow', { speed: 0.5 });
    expect(fast.of('projectile')[0].t).toBeCloseTo(normal.of('projectile')[0].t / 2);
    const sniped = play('snipe', { speed: 0.5 });
    expect(sniped.of('projectile')[0].args[2]).toBeCloseTo(0.04);
  });

  it('mirrors for the enemy side', () => {
    const player = play('thrust', { team: 'player' });
    const enemy = play('thrust', { team: 'enemy' });
    expect(player.of('slash')[0].args[2]).toBe(1);
    expect(enemy.of('slash')[0].args[2]).toBe(-1);
  });
});
