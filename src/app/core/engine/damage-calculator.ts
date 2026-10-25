import { AbilityDefinition } from '../models/ability.model';
import { UnitInstance } from '../models/unit-instance.model';
import { bondPower } from '../models/bond.model';
import { COVER_SHARE, blockShare, coverFor } from './shield';

/** A blow worked out in full: what lands, and what shields stopped on the way. */
export interface Blow {
  readonly damage: number;
  /** Stopped by the target's own shield. */
  readonly blocked: number;
  /** Stopped by a guarding lane-mate's shield in front of the target. */
  readonly covered: number;
  readonly coveredBy?: UnitInstance;
}

/**
 * Calculates raw and net combat numbers for abilities.
 */
export class DamageCalculator {
  public static hasAdvantage(attacker: UnitInstance, target: UnitInstance): boolean {
    if (attacker.team === target.team) return false;
    const from = attacker.classDef.archetype;
    const to = target.classDef.archetype;
    return (
      (from === 'melee' && to === 'ranged') ||
      (from === 'ranged' && to === 'magic') ||
      (from === 'magic' && to === 'melee')
    );
  }

  /**
   * Computes the raw power output before defence reduction.
   */
  public static calculateRaw(attacker: UnitInstance, ability: AbilityDefinition): number {
    let raw = 0;
    switch (ability.damageType) {
      case 'physical':
        raw = attacker.effectiveAttack * ability.powerMultiplier;
        break;
      case 'magical':
        raw = attacker.stats.magicAttack * ability.powerMultiplier;
        break;
      case 'healing':
        raw = attacker.stats.magicAttack * ability.powerMultiplier;
        break;
    }
    return Math.max(1, Math.floor(raw));
  }

  /**
   * Computes net damage after defense and shields (or healing without defense check).
   * Pass the battlefield's units so a guarding shield-bearer can cover the target.
   */
  public static calculateWithDefense(
    attacker: UnitInstance,
    target: UnitInstance,
    ability: AbilityDefinition,
    /** The execution grade's multiplier; healing ignores it. */
    power = 1,
    units: readonly UnitInstance[] = [],
  ): number {
    return this.resolve(attacker, target, ability, power, units).damage;
  }

  /**
   * A blow in full: defense first, then the target's shield blocks its share of a frontal
   * hit, then a guarding lane-mate's shield covers part of a missile. Never below 1.
   */
  public static resolve(
    attacker: UnitInstance,
    target: UnitInstance,
    ability: AbilityDefinition,
    power = 1,
    units: readonly UnitInstance[] = [],
  ): Blow {
    const base = this.beforeShields(attacker, target, ability, power);
    if (ability.damageType === 'healing') return { damage: base, blocked: 0, covered: 0 };
    const afterBlock = Math.max(1, base - Math.round(base * blockShare(attacker, target, ability)));
    const coveredBy = coverFor(attacker, target, ability, units);
    const damage = coveredBy
      ? Math.max(1, afterBlock - Math.round(afterBlock * COVER_SHARE))
      : afterBlock;
    return { damage, blocked: base - afterBlock, covered: afterBlock - damage, coveredBy };
  }

  /** Net damage after defense, the triangle, timing and bonds, before any shield. */
  private static beforeShields(
    attacker: UnitInstance,
    target: UnitInstance,
    ability: AbilityDefinition,
    power: number,
  ): number {
    if (ability.damageType === 'healing') {
      return this.calculateRaw(attacker, ability);
    }

    const raw = this.calculateRaw(attacker, ability);
    const defense =
      ability.damageType === 'physical' ? target.effectiveDefense : target.stats.magicDefense;

    const net = Math.max(1, raw - defense);
    // MVP tuning: the tactical triangle adds 25% after defense, with no reverse penalty.
    const triangle = this.hasAdvantage(attacker, target) ? 1.25 : 1;
    return Math.max(1, Math.floor(net * triangle * power * bondPower(attacker)));
  }
}
