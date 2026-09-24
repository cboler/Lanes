import { AbilityDefinition } from '../models/ability.model';
import { DefenseTargetPriority } from '../models/defense-plan.model';
import { UnitInstance } from '../models/unit-instance.model';
import { CombatExecutor } from './combat-executor';

/** Select from legal targets only; stable battlefield order resolves ties. */
export function chooseDefenseTarget(
  attacker: UnitInstance,
  ability: AbilityDefinition,
  units: readonly UnitInstance[],
  priority: DefenseTargetPriority,
): UnitInstance | null {
  const legal = CombatExecutor.getValidTargets(attacker, ability, units);
  const valid =
    ability.damageType === 'healing' ? legal.filter((unit) => unit.currentHp < unit.maxHp) : legal;
  if (!valid.length) return null;
  switch (priority) {
    case 'lowest-hp':
      return [...valid].sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0];
    case 'closest':
      return [...valid].sort(
        (a, b) =>
          Math.abs(a.lane - attacker.lane) - Math.abs(b.lane - attacker.lane) ||
          Math.abs(a.positionX - attacker.positionX) - Math.abs(b.positionX - attacker.positionX),
      )[0];
    case 'leader':
      return (
        valid.find(
          (unit) =>
            unit ===
            units.find(
              (candidate) =>
                candidate.isAlive &&
                (ability.damageType === 'healing'
                  ? candidate.team === attacker.team
                  : candidate.team !== attacker.team),
            ),
        ) ?? chooseDefenseTarget(attacker, ability, units, 'closest')
      );
    case 'front-lane':
      return [...valid].sort((a, b) => a.lane - b.lane)[0];
  }
}
