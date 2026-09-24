import { AbilityDefinition } from '../models/ability.model';
import { UnitInstance } from '../models/unit-instance.model';

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
   * Computes net damage after defense (or healing without defense check).
   */
  public static calculateWithDefense(
    attacker: UnitInstance,
    target: UnitInstance,
    ability: AbilityDefinition,
  ): number {
    if (ability.damageType === 'healing') {
      return this.calculateRaw(attacker, ability);
    }

    const raw = this.calculateRaw(attacker, ability);
    const defense =
      ability.damageType === 'physical' ? target.effectiveDefense : target.stats.magicDefense;

    const net = Math.max(1, raw - defense);
    // MVP tuning: the tactical triangle adds 25% after defense, with no reverse penalty.
    return Math.floor(net * (this.hasAdvantage(attacker, target) ? 1.25 : 1));
  }
}
