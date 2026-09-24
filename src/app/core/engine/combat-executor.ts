import { AbilityDefinition } from '../models/ability.model';
import { UnitInstance } from '../models/unit-instance.model';
import { StatusEffectInstance, StatusEffectType } from '../models/status-effect.model';
import { DamageCalculator } from './damage-calculator';

export interface TargetEffect {
  readonly target: UnitInstance;
  readonly amount: number;
  readonly guardAbsorbed: number;
  readonly statusApplied?: StatusEffectType;
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
      case 'single-enemy': {
        const laneEnemies = enemies.filter((e) => e.lane === attacker.lane);
        if (laneEnemies.length === 0) return [];
        if (ability.crossLane) {
          return laneEnemies;
        }
        // Direct single-target attack in same lane: closest enemy shields backline
        const frontmost = laneEnemies.reduce((closest, current) => {
          const distClosest = Math.abs(closest.positionX - attacker.positionX);
          const distCurrent = Math.abs(current.positionX - attacker.positionX);
          return distCurrent < distClosest ? current : closest;
        }, laneEnemies[0]);
        return [frontmost];
      }
      case 'single-ally':
        if (ability.id === 'bulwark') return allies.filter((a) => a === attacker);
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

    if (attacker.isStunned) {
      return { success: false, failureReason: 'Attacker is stunned.', effects: [] };
    }

    if (!attacker.classDef.abilities.includes(ability)) {
      return {
        success: false,
        failureReason: 'Ability does not belong to this unit.',
        effects: [],
      };
    }

    const validTargets = this.getValidTargets(attacker, ability, allBattlefieldUnits);
    const isSingleTarget = ability.target.startsWith('single-');
    if (
      selectedTargets.length === 0 ||
      new Set(selectedTargets).size !== selectedTargets.length ||
      (isSingleTarget && selectedTargets.length !== 1) ||
      (!isSingleTarget && selectedTargets.length !== validTargets.length) ||
      selectedTargets.some((target) => !validTargets.includes(target))
    ) {
      return { success: false, failureReason: 'Invalid ability targets.', effects: [] };
    }

    if (ability.id === 'bulwark' && attacker.hasEffect('defense-up')) {
      return { success: false, failureReason: 'Bulwark is already active.', effects: [] };
    }

    if (!attacker.actionGauge.trySpend(ability.actionCost)) {
      return { success: false, failureReason: 'Insufficient action gauge.', effects: [] };
    }

    // Bulwark is the only MVP self buff; a general skill-effect system can replace this as classes expand.
    if (ability.id === 'bulwark') {
      attacker.applyStatusEffect(new StatusEffectInstance('defense-up', 2, 25));
      return {
        success: true,
        effects: [
          {
            target: attacker,
            amount: 0,
            guardAbsorbed: 0,
            statusApplied: 'defense-up',
            isHealing: false,
            wasDefeated: false,
            isFriendlyFire: false,
          },
        ],
      };
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
        const amount = target.heal(
          DamageCalculator.calculateWithDefense(attacker, target, ability),
        );
        effects.push({
          target,
          amount,
          guardAbsorbed: 0,
          isHealing: true,
          wasDefeated: false,
          isFriendlyFire: false,
        });
      } else {
        const damage = DamageCalculator.calculateWithDefense(attacker, target, ability);
        const wasAlive = target.isAlive;
        const guardBefore = target.guardPoints;
        const amount = target.takeDamage(damage);
        const wasDefeated = wasAlive && !target.isAlive;

        effects.push({
          target,
          amount,
          guardAbsorbed: guardBefore - target.guardPoints,
          isHealing: false,
          wasDefeated,
          isFriendlyFire,
        });
      }
    }

    return { success: true, effects };
  }
}
