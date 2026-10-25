import { describe, expect, it } from 'vitest';
import { UnitInstance } from '../models/unit-instance.model';
import {
  ARCHER_CLASS,
  CLERIC_CLASS,
  ENGINE_CLASSES,
  FIGHTER_CLASS,
  LANCER_CLASS,
  WITCH_CLASS,
} from '../models/unit-class.model';
import { AbilityDefinition } from '../models/ability.model';
import { StatusEffectInstance } from '../models/status-effect.model';
import { DamageCalculator } from './damage-calculator';
import { CombatExecutor } from './combat-executor';
import { BLOCK_SHARE, blockShare, coverFor } from './shield';

const skill = (cls: typeof ARCHER_CLASS, id: string): AbilityDefinition =>
  [...cls.abilities, ...cls.advancedAbilities].find((a) => a.id === id)!;
const unit = (cls: typeof ARCHER_CLASS, team: 'player' | 'enemy', lane: number, x: number) =>
  new UnitInstance(cls, cls.name, team, lane, x, 100, `${team}-${cls.id}-${lane}-${x}`, undefined, {
    abilities: [...cls.abilities, ...cls.advancedAbilities],
  });

describe('shields', () => {
  const quickShot = skill(ARCHER_CLASS, 'quick_shot');
  const piercing = skill(ARCHER_CLASS, 'piercing_arrow');

  it('blocks more of an arrow than of a blade from the front, none of magic', () => {
    const fighter = unit(FIGHTER_CLASS, 'enemy', 1, 0.7);
    const archer = unit(ARCHER_CLASS, 'player', 1, 0.2);
    const lancer = unit(LANCER_CLASS, 'player', 1, 0.5);
    const witch = unit(WITCH_CLASS, 'player', 1, 0.2);
    expect(blockShare(archer, fighter, quickShot)).toBe(BLOCK_SHARE.missile);
    expect(blockShare(lancer, fighter, skill(LANCER_CLASS, 'thrust'))).toBe(BLOCK_SHARE.melee);
    expect(blockShare(witch, fighter, WITCH_CLASS.abilities[0])).toBe(0);
    // Siege engines fire missiles too.
    const ballista = unit(ENGINE_CLASSES.ballista, 'player', 1, 0.1);
    expect(blockShare(ballista, fighter, ENGINE_CLASSES.ballista.abilities[0])).toBe(
      BLOCK_SHARE.missile,
    );
    // Other classes carry no shield.
    expect(blockShare(archer, unit(LANCER_CLASS, 'enemy', 1, 0.7), quickShot)).toBe(0);
  });

  it('takes the block off after armour, and shows it on the hit', () => {
    const fighter = unit(FIGHTER_CLASS, 'enemy', 1, 0.7);
    const archer = unit(ARCHER_CLASS, 'player', 1, 0.2);
    // 75 ATK × 1.3 = 97, less 50 DEF = 47; the shield stops 40% of that (19).
    expect(DamageCalculator.resolve(archer, fighter, piercing)).toMatchObject({
      damage: 28,
      blocked: 19,
      covered: 0,
    });
    const result = CombatExecutor.execute(archer, piercing, [fighter], [archer, fighter]);
    expect(result.effects[0]).toMatchObject({ amount: 28, blocked: 19 });
    expect(fighter.currentHp).toBe(fighter.maxHp - 28);
  });

  it('blocks nothing from behind or while stunned', () => {
    const fighter = unit(FIGHTER_CLASS, 'enemy', 1, 0.5);
    const behind = unit(ARCHER_CLASS, 'player', 1, 0.9);
    expect(blockShare(behind, fighter, quickShot)).toBe(0);
    const front = unit(ARCHER_CLASS, 'player', 1, 0.2);
    expect(blockShare(front, fighter, quickShot)).toBe(BLOCK_SHARE.missile);
    fighter.applyStatusEffect(new StatusEffectInstance('stun', 1));
    expect(blockShare(front, fighter, quickShot)).toBe(0);
  });

  it('on Guard, covers lane-mates behind it from missiles shot past it', () => {
    const fighter = unit(FIGHTER_CLASS, 'enemy', 1, 0.6);
    const witch = unit(WITCH_CLASS, 'enemy', 1, 0.85);
    const archer = unit(ARCHER_CLASS, 'player', 1, 0.2);
    const field = [archer, fighter, witch];
    // Not guarding: no cover.
    expect(coverFor(archer, witch, piercing, field)).toBeUndefined();
    fighter.enterGuard();
    expect(coverFor(archer, witch, piercing, field)).toBe(fighter);
    const open = DamageCalculator.resolve(archer, witch, piercing);
    const covered = DamageCalculator.resolve(archer, witch, piercing, 1, field);
    expect(covered.coveredBy).toBe(fighter);
    expect(covered.damage).toBe(open.damage - Math.round(open.damage * 0.33));
    const result = CombatExecutor.execute(archer, piercing, [witch], field);
    expect(result.effects[0]).toMatchObject({ coveredBy: fighter.id, covered: covered.covered });
    // A shooter who has slipped behind the fighter, a caster, or a unit in front gets no cover.
    const flanker = unit(ARCHER_CLASS, 'player', 1, 0.75);
    expect(coverFor(flanker, witch, piercing, [flanker, fighter, witch])).toBeUndefined();
    const witchCaster = unit(WITCH_CLASS, 'player', 1, 0.2);
    expect(coverFor(witchCaster, witch, WITCH_CLASS.abilities[0], field)).toBeUndefined();
    const ahead = unit(CLERIC_CLASS, 'enemy', 1, 0.4);
    expect(coverFor(archer, ahead, piercing, [...field, ahead])).toBeUndefined();
    // Nor does anyone in another lane.
    const neighbour = unit(WITCH_CLASS, 'enemy', 0, 0.85);
    expect(coverFor(archer, neighbour, piercing, [...field, neighbour])).toBeUndefined();
  });

  it('works for the player side too, facing the other way', () => {
    const fighter = unit(FIGHTER_CLASS, 'player', 1, 0.35);
    const cleric = unit(CLERIC_CLASS, 'player', 1, 0.14);
    const archer = unit(ARCHER_CLASS, 'enemy', 1, 0.86);
    fighter.enterGuard();
    expect(blockShare(archer, fighter, quickShot)).toBe(BLOCK_SHARE.missile);
    expect(coverFor(archer, cleric, piercing, [fighter, cleric, archer])).toBe(fighter);
  });
});
