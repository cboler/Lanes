import { AbilityDefinition } from '../models/ability.model';
import { UnitInstance } from '../models/unit-instance.model';

/**
 * Calculates raw and net combat numbers for abilities.
 */
export class DamageCalculator {
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

    return Math.max(1, raw - defense);
  }
}
