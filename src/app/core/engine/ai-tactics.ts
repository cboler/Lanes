import { AbilityDefinition } from '../models/ability.model';
import { UnitInstance } from '../models/unit-instance.model';
import { CombatExecutor } from './combat-executor';

/*
 * How the role AI values what a skill leaves behind, in the same currency as damage
 * (HP), so a stun or a debuff can win over a slightly bigger hit. Pure and deterministic,
 * like the rest of the AI, so defense battles replay the same way.
 */

/** Whether `unit` already has the skill's status at least as strong. */
function hasStatus(unit: UnitInstance, ability: AbilityDefinition): boolean {
  const status = ability.status;
  return (
    !!status &&
    unit.statusEffects.some(
      (effect) =>
        effect.type === status.type && !effect.isExpired && effect.potency >= status.potency,
    )
  );
}

/** What the status is worth on a target that survives a hit of `damage`. */
export function statusValue(
  ability: AbilityDefinition,
  target: UnitInstance,
  damage: number,
): number {
  const status = ability.status;
  if (!status || hasStatus(target, ability) || damage >= target.currentHp + target.guardPoints) {
    return 0;
  }
  switch (status.type) {
    case 'stun':
      // A lost turn is worth about a solid hit.
      return 40;
    case 'poison':
      return Math.min(target.currentHp - damage, status.potency * status.duration);
    case 'attack-down':
    case 'defense-down':
      return status.potency;
    default:
      return 0;
  }
}

/**
 * A pure buff worth casting now: it must reach the caster (a self buff) or at least two
 * allies who lack it, and leave enough AP for an attack afterwards, so buffing never
 * replaces fighting.
 */
export function chooseBuff(
  unit: UnitInstance,
  units: readonly UnitInstance[],
): AbilityDefinition | null {
  const attacks = unit.abilities.filter(
    (a) => a.powerMultiplier > 0 && a.damageType !== 'healing' && a.target.includes('enem'),
  );
  const cheapestAttack = Math.min(...attacks.map((a) => a.actionCost));
  for (const ability of unit.abilities) {
    if (ability.powerMultiplier !== 0 || !ability.status) continue;
    if (unit.actionGauge.current < ability.actionCost + cheapestAttack) continue;
    const fresh = CombatExecutor.getValidTargets(unit, ability, units).filter(
      (target) => !hasStatus(target, ability),
    );
    if (fresh.length >= (ability.target === 'self' ? 1 : 2)) return ability;
  }
  return null;
}
