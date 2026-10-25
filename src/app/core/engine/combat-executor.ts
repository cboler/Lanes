import { AbilityDefinition } from '../models/ability.model';
import { UnitInstance } from '../models/unit-instance.model';
import { StatusEffectInstance, StatusEffectType } from '../models/status-effect.model';
import { DamageCalculator } from './damage-calculator';
import { ExecutionGrade, GRADE_POWER } from './execution';
import { inReach, needsReach, slideRoom } from './field';

export interface TargetEffect {
  readonly target: UnitInstance;
  readonly amount: number;
  readonly guardAbsorbed: number;
  /** Damage the target's own shield blocked. */
  readonly blocked?: number;
  /** Damage a guarding lane-mate's shield took off, and that lane-mate's id. */
  readonly covered?: number;
  readonly coveredBy?: string;
  readonly statusApplied?: StatusEffectType;
  readonly isHealing: boolean;
  readonly wasDefeated: boolean;
  readonly isFriendlyFire: boolean;
  /** The shot missed: no damage, no Guard spent. */
  readonly missed: boolean;
  /** How far a knockback moved the target along its lane, as a field fraction. */
  readonly pushed?: number;
  /** Extra damage from being slammed into a lane-mate or the field's edge (included in amount). */
  readonly crash?: number;
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
    let targets = this.inScope(attacker, ability, allUnits);
    // Some blows only carry so far along the lane (a Sparkcoil's lightning).
    if (ability.range !== undefined) {
      targets = targets.filter(
        (target) => Math.abs(target.positionX - attacker.positionX) <= ability.range! + 1e-9,
      );
    }
    // A melee weapon reaches only so far along the lane: close in, or the skill has no target.
    return needsReach(attacker, ability)
      ? targets.filter((target) => inReach(attacker, target))
      : targets;
  }

  /** Who a skill's target scope covers, before melee reach. */
  private static inScope(
    attacker: UnitInstance,
    ability: AbilityDefinition,
    allUnits: readonly UnitInstance[],
  ): UnitInstance[] {
    const living = allUnits.filter((u) => u.isAlive);
    const enemies = living.filter((u) => u.team !== attacker.team);
    const allies = living.filter((u) => u.team === attacker.team && !u.isObject);

    switch (ability.target) {
      case 'self':
        return attacker.isAlive ? [attacker] : [];
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
   * and calculating damage/healing with friendly fire considerations. `grade` is the player's
   * execution timing; AI and defense orders pass none, which resolves at normal power.
   */
  public static execute(
    attacker: UnitInstance,
    ability: AbilityDefinition,
    selectedTargets: readonly UnitInstance[],
    allBattlefieldUnits: readonly UnitInstance[] = selectedTargets,
    grade?: ExecutionGrade,
    /** False for an assist: the ally acts outside its turn, free of AP. */
    spendAp = true,
    /** Extra power on top of the grade, such as a Trusted bond's assist. */
    bonus = 1,
  ): CombatResult {
    if (!attacker.isAlive) {
      return { success: false, failureReason: 'Attacker is dead.', effects: [] };
    }

    if (attacker.isStunned) {
      return { success: false, failureReason: 'Attacker is stunned.', effects: [] };
    }

    if (!attacker.abilities.includes(ability)) {
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

    // A pure buff that every target already has at full strength would waste the AP.
    const status = ability.status;
    if (
      ability.powerMultiplier === 0 &&
      status &&
      selectedTargets.every((target) =>
        target.statusEffects.some(
          (effect) =>
            effect.type === status.type && !effect.isExpired && effect.potency >= status.potency,
        ),
      )
    ) {
      return { success: false, failureReason: `${ability.name} is already active.`, effects: [] };
    }

    if (spendAp && !attacker.actionGauge.trySpend(ability.actionCost)) {
      return { success: false, failureReason: 'Insufficient action gauge.', effects: [] };
    }

    // A pure buff or debuff: no numbers, only the status.
    if (ability.powerMultiplier === 0) {
      return {
        success: true,
        effects: selectedTargets.map((target) => ({
          target,
          amount: 0,
          guardAbsorbed: 0,
          statusApplied: this.applyStatus(ability, target),
          isHealing: false,
          wasDefeated: false,
          isFriendlyFire: false,
          missed: false,
        })),
      };
    }

    const power = (grade ? GRADE_POWER[grade] : 1) * bonus;
    if (power === 0) {
      // A miss spends the AP but lands nowhere, so it cannot catch allies either.
      return {
        success: true,
        effects: selectedTargets.map((target) => ({
          target,
          amount: 0,
          guardAbsorbed: 0,
          isHealing: false,
          wasDefeated: false,
          isFriendlyFire: false,
          missed: true,
        })),
      };
    }

    const effects: TargetEffect[] = [];
    const targetsToAffect = new Set<UnitInstance>(selectedTargets.filter((t) => t.isAlive));

    // A lane splash (a catapult stone) lands on every enemy in the chosen target's lane.
    if (ability.splash === 'lane') {
      for (const unit of allBattlefieldUnits) {
        if (
          unit.isAlive &&
          unit.team !== attacker.team &&
          selectedTargets.some((target) => target.lane === unit.lane)
        ) {
          targetsToAffect.add(unit);
        }
      }
    }

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
          statusApplied: this.applyStatus(ability, target),
          isHealing: true,
          wasDefeated: false,
          isFriendlyFire: false,
          missed: false,
        });
      } else {
        const blow = DamageCalculator.resolve(
          attacker,
          target,
          ability,
          power,
          allBattlefieldUnits,
        );
        const damage = blow.damage;
        const wasAlive = target.isAlive;
        const guardBefore = target.guardPoints;
        const amount = target.takeDamage(damage);
        const wasDefeated = wasAlive && !target.isAlive;

        effects.push({
          target,
          amount,
          guardAbsorbed: guardBefore - target.guardPoints,
          blocked: blow.blocked || undefined,
          covered: blow.covered || undefined,
          coveredBy: blow.coveredBy?.id,
          statusApplied: this.applyStatus(ability, target),
          isHealing: false,
          wasDefeated,
          isFriendlyFire,
          missed: false,
        });
      }
    }

    if (ability.knockback)
      this.knockBack(attacker, ability.knockback, effects, allBattlefieldUnits);
    return { success: true, effects };
  }

  /**
   * Shoves every enemy the skill hit back along its lane, farthest first so a crowd
   * spreads rather than stacks. A target that cannot travel the full distance is slammed
   * into a lane-mate or the field's edge and takes a quarter of the hit again.
   */
  private static knockBack(
    attacker: UnitInstance,
    distance: number,
    effects: TargetEffect[],
    units: readonly UnitInstance[],
  ): void {
    const order = effects
      .map((effect, index) => ({ effect, index }))
      .filter(
        ({ effect }) => !effect.missed && !effect.isHealing && effect.target.team !== attacker.team,
      )
      .sort(
        (a, b) =>
          Math.abs(b.effect.target.positionX - attacker.positionX) -
          Math.abs(a.effect.target.positionX - attacker.positionX),
      );
    for (const { effect, index } of order) {
      const target = effect.target;
      // A barricade stands fast.
      if (!target.isAlive || target.isObject) continue;
      const dir =
        Math.sign(target.positionX - attacker.positionX) || (attacker.team === 'player' ? 1 : -1);
      const pushed = Math.min(distance, slideRoom(target, dir, units));
      target.positionX += dir * pushed;
      let crash = 0;
      if (pushed < distance - 1e-6)
        crash = target.takeDamage(Math.max(1, Math.floor(effect.amount / 4)));
      effects[index] = {
        ...effect,
        amount: effect.amount + crash,
        wasDefeated: effect.wasDefeated || !target.isAlive,
        pushed,
        crash,
      };
    }
  }

  /** Leaves the skill's status on a target still standing; returns its type if applied. */
  private static applyStatus(
    ability: AbilityDefinition,
    target: UnitInstance,
  ): StatusEffectType | undefined {
    const status = ability.status;
    if (!status || !target.isAlive || target.isObject) return undefined;
    target.refreshStatusEffect(
      new StatusEffectInstance(status.type, status.duration, status.potency),
    );
    return status.type;
  }
}
