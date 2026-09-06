import { AbilityDefinition } from '../models/ability.model';
import { UnitInstance } from '../models/unit-instance.model';
import { DamageCalculator } from './damage-calculator';

export interface TargetEffect {
  readonly target: UnitInstance;
  readonly amount: number;
  readonly isHealing: boolean;
  readonly wasDefeated: boolean;
  readonly isFriendlyFire: boolean;
}

export interface CombatResult {
  readonly success: boolean;
  readonly failureReason?: string;
  readonly effects: readonly TargetEffect[];
}

export class CombatExecutor {
  /**
   * Identifies valid targets for an ability given the battlefield context.
   */
  public static getValidTargets(
    attacker: UnitInstance,
    ability: AbilityDefinition,
    allUnits: readonly UnitInstance[],
  ): UnitInstance[] {
    const living = allUnits.filter((u) => u.isAlive);
    const enemies = living.filter((u) => u.team !== attacker.team);
    const allies = living.filter((u) => u.team === attacker.team);

    switch (ability.target) {
      case 'single-enemy':
        return enemies.filter((e) => e.lane === attacker.lane);
      case 'single-ally':
        return allies.filter((a) => a.lane === attacker.lane);
      case 'same-lane-enemies':
        return enemies.filter((e) => e.lane === attacker.lane);
      case 'single-enemy-any-lane':
        return enemies;
      case 'single-ally-any-lane':
        return allies;
      case 'all-enemies':
        return enemies;
      case 'all-allies':
        return allies;
      default:
        return [];
    }
  }

  /**
   * Executes an ability from attacker against targeted units, deducting action cost
   * and calculating damage/healing with friendly fire considerations.
   */
  public static execute(
    attacker: UnitInstance,
    ability: AbilityDefinition,
    selectedTargets: readonly UnitInstance[],
    allBattlefieldUnits: readonly UnitInstance[] = selectedTargets,
  ): CombatResult {
    if (!attacker.isAlive) {
      return { success: false, failureReason: 'Attacker is dead.', effects: [] };
    }

    if (!attacker.actionGauge.trySpend(ability.actionCost)) {
      return { success: false, failureReason: 'Insufficient action gauge.', effects: [] };
    }

    const effects: TargetEffect[] = [];
    const targetsToAffect = new Set<UnitInstance>(selectedTargets.filter((t) => t.isAlive));

    // Handle friendly fire inclusions if ability specifies it
    if (ability.friendlyFire) {
      if (ability.target === 'all-enemies') {
        // Meteor hits all living units on battlefield (except perhaps caster or including all allies)
        for (const unit of allBattlefieldUnits) {
          if (unit.isAlive && unit.id !== attacker.id) {
            targetsToAffect.add(unit);
          }
        }
      } else if (ability.target === 'same-lane-enemies') {
        // Explosive shot hits all allies in the same lane too
        for (const unit of allBattlefieldUnits) {
          if (unit.isAlive && unit.lane === attacker.lane && unit.id !== attacker.id) {
            targetsToAffect.add(unit);
          }
        }
      }
    }

    for (const target of targetsToAffect) {
      const isHealing = ability.damageType === 'healing';
      const isFriendlyFire = target.team === attacker.team && !isHealing;

      if (isHealing) {
        const amount = DamageCalculator.calculateWithDefense(attacker, target, ability);
        target.heal(amount);
        effects.push({
          target,
          amount,
          isHealing: true,
          wasDefeated: false,
          isFriendlyFire: false,
        });
      } else {
        const damage = DamageCalculator.calculateWithDefense(attacker, target, ability);
        const wasAlive = target.isAlive;
        target.takeDamage(damage);
        const wasDefeated = wasAlive && !target.isAlive;

        effects.push({
          target,
          amount: damage,
          isHealing: false,
          wasDefeated,
          isFriendlyFire,
        });
      }
    }

    return { success: true, effects };
  }
}
