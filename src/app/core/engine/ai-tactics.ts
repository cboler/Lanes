import { AbilityDefinition } from '../models/ability.model';
import { UnitInstance } from '../models/unit-instance.model';
import { CombatExecutor } from './combat-executor';
import { inReach } from './field';
import { FieldTrap, placementSpot } from '../models/field-object.model';

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

/**
 * A barricade or trap worth setting down now, or null. A unit keeps one on the field at a
 * time (`placedAlready`), and only places where the object will matter:
 *   a barricade, while no foe is in reach yet, in front of an ally who fights from behind
 *   it (a shot or a spell), with a foe in the lane to stop;
 *   a trap, in the path of a foe in the lane who must walk in to fight, leaving AP for a
 *   shot afterwards, as a buff does.
 */
export function choosePlacement(
  unit: UnitInstance,
  units: readonly UnitInstance[],
  traps: readonly FieldTrap[],
  placedAlready: boolean,
): AbilityDefinition | null {
  if (placedAlready) return null;
  const dir = unit.team === 'player' ? 1 : -1;
  const foes = units.filter(
    (u) => u.isAlive && !u.isObject && u.team !== unit.team && u.lane === unit.lane,
  );
  if (!foes.length) return null;
  const attacks = unit.abilities.filter(
    (a) => a.powerMultiplier > 0 && a.damageType !== 'healing' && a.target.includes('enem'),
  );
  const cheapestAttack = Math.min(...attacks.map((a) => a.actionCost));
  for (const ability of unit.abilities) {
    if (!ability.place || unit.actionGauge.current < ability.actionCost) continue;
    const x = placementSpot(unit, ability.place, units, traps);
    if (x === null) continue;
    if (ability.place === 'barricade') {
      const guarded = units.some(
        (u) =>
          u !== unit &&
          u.isAlive &&
          !u.isObject &&
          u.team === unit.team &&
          u.lane === unit.lane &&
          u.classDef.archetype !== 'melee' &&
          (x - u.positionX) * dir > 0,
      );
      if (guarded && !foes.some((foe) => inReach(unit, foe))) return ability;
    } else {
      const walker = foes.some(
        (foe) => foe.classDef.archetype === 'melee' && (foe.positionX - x) * dir > 0,
      );
      if (walker && unit.actionGauge.current >= ability.actionCost + cheapestAttack) return ability;
    }
  }
  return null;
}
