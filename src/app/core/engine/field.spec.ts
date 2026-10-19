import { describe, expect, it } from 'vitest';
import { CombatExecutor } from './combat-executor';
import { FIELD_MAX_X, inReach, meleeReach, slideRoom } from './field';
import { UnitInstance } from '../models/unit-instance.model';
import {
  ARCHER_CLASS,
  FIGHTER_CLASS,
  GUNNER_CLASS,
  LANCER_CLASS,
} from '../models/unit-class.model';

const unit = (cls: typeof FIGHTER_CLASS, team: 'player' | 'enemy', x: number, lane = 1) =>
  new UnitInstance(cls, `${team} ${cls.name} ${x}`, team, lane, x);

describe('melee reach', () => {
  it('reaches further with a polearm, and ranged attacks ignore it', () => {
    const fighter = unit(FIGHTER_CLASS, 'player', 0.32);
    const lancer = unit(LANCER_CLASS, 'player', 0.32, 0);
    expect(meleeReach(lancer)).toBeCloseTo(2 * meleeReach(fighter));
    const foe = unit(FIGHTER_CLASS, 'enemy', 0.68);
    const all = [fighter, foe];
    expect(inReach(fighter, foe)).toBe(false);
    expect(CombatExecutor.getValidTargets(fighter, FIGHTER_CLASS.abilities[0], all)).toEqual([]);
    fighter.positionX = 0.5;
    expect(CombatExecutor.getValidTargets(fighter, FIGHTER_CLASS.abilities[0], all)).toEqual([foe]);
    const archer = unit(ARCHER_CLASS, 'player', 0.05);
    expect(
      CombatExecutor.getValidTargets(archer, ARCHER_CLASS.abilities[0], [archer, foe]),
    ).toEqual([foe]);
  });

  it('measures the room to slide before a lane-mate or the edge', () => {
    const a = unit(FIGHTER_CLASS, 'enemy', 0.6);
    const b = unit(FIGHTER_CLASS, 'enemy', 0.75);
    const other = unit(FIGHTER_CLASS, 'enemy', 0.7, 2);
    expect(slideRoom(a, 1, [a, b, other])).toBeCloseTo(0.07);
    expect(slideRoom(b, 1, [a, b, other])).toBeCloseTo(FIELD_MAX_X - 0.75);
    expect(slideRoom(b, -1, [a, b, other])).toBeCloseTo(0.07);
  });
});

describe('knockback', () => {
  it('shoves the target back along its lane', () => {
    const fighter = unit(FIGHTER_CLASS, 'player', 0.4);
    const foe = unit(FIGHTER_CLASS, 'enemy', 0.55);
    const result = CombatExecutor.execute(
      fighter,
      FIGHTER_CLASS.abilities[0],
      [foe],
      [fighter, foe],
    );
    expect(result.effects[0].pushed).toBeCloseTo(0.08);
    expect(result.effects[0].crash).toBe(0);
    expect(foe.positionX).toBeCloseTo(0.63);
  });

  it('slams a target that has no room into its lane-mate for a quarter of the hit again', () => {
    const fighter = unit(FIGHTER_CLASS, 'player', 0.4);
    const foe = unit(FIGHTER_CLASS, 'enemy', 0.55);
    const behind = unit(FIGHTER_CLASS, 'enemy', 0.65);
    const all = [fighter, foe, behind];
    const hp = foe.currentHp;
    const [effect] = CombatExecutor.execute(
      fighter,
      FIGHTER_CLASS.abilities[0],
      [foe],
      all,
    ).effects;
    expect(effect.pushed).toBeCloseTo(0.02);
    expect(effect.crash).toBeGreaterThan(0);
    expect(hp - foe.currentHp).toBe(effect.amount);
    expect(foe.positionX).toBeCloseTo(0.57);
  });

  it('pushes enemies in a blast but never the allies it catches', () => {
    const gunner = unit(GUNNER_CLASS, 'player', 0.14);
    const ally = unit(FIGHTER_CLASS, 'player', 0.32);
    const foe = unit(FIGHTER_CLASS, 'enemy', 0.68);
    const shot = GUNNER_CLASS.abilities[2];
    const result = CombatExecutor.execute(gunner, shot, [foe], [gunner, ally, foe]);
    expect(result.effects.find((e) => e.target === foe)?.pushed).toBeCloseTo(0.06);
    expect(ally.positionX).toBe(0.32);
  });
});
