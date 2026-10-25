import { AbilityDefinition } from '../models/ability.model';
import { UnitInstance } from '../models/unit-instance.model';

/*
 * Shields. A shield-bearer (the Fighter) blocks a fixed share of every physical blow that
 * comes at it from the front: more of arrows, bullets and engine bolts than of blades,
 * none of magic, and nothing from behind or while stunned. On Guard it also covers the
 * lane-mates standing behind it from missiles shot past it. Fixed shares and no dice,
 * so a battle replays the same way every time.
 */

/** Share of a frontal hit the shield stops. */
export const BLOCK_SHARE = { missile: 0.4, melee: 0.2 } as const;
/** Share of a missile a guarding shield-bearer takes off for a lane-mate behind it. */
export const COVER_SHARE = 0.33;

/** A shield that can be raised right now. */
export function bearsShield(unit: UnitInstance): boolean {
  return !!unit.classDef.shield && unit.isAlive && !unit.isStunned;
}

/** Arrows, bullets and engine shots, as opposed to blades and spells. */
export function isMissile(attacker: UnitInstance): boolean {
  return attacker.classDef.archetype === 'ranged' || !!attacker.classDef.engine;
}

/** The direction a unit faces along its lane: players face +x, enemies -x. */
export function facing(unit: UnitInstance): 1 | -1 {
  return unit.team === 'player' ? 1 : -1;
}

/** Whether a point along the lane is in front of the unit (level with it counts). */
export function inFront(unit: UnitInstance, x: number): boolean {
  return (x - unit.positionX) * facing(unit) >= -1e-9;
}

/** The share of this hit the target's own shield blocks: 0 when it has none or is caught from behind. */
export function blockShare(
  attacker: UnitInstance,
  target: UnitInstance,
  ability: AbilityDefinition,
): number {
  if (ability.damageType !== 'physical' || !bearsShield(target) || attacker === target) return 0;
  if (!inFront(target, attacker.positionX)) return 0;
  return isMissile(attacker) ? BLOCK_SHARE.missile : BLOCK_SHARE.melee;
}

/**
 * The guarding shield-bearer standing between a missile's shooter and its target, in the
 * target's lane, or undefined. The nearest such bearer to the target covers it.
 */
export function coverFor(
  attacker: UnitInstance,
  target: UnitInstance,
  ability: AbilityDefinition,
  units: readonly UnitInstance[],
): UnitInstance | undefined {
  if (ability.damageType !== 'physical' || !isMissile(attacker) || target.isObject) return;
  return units
    .filter(
      (unit) =>
        unit !== target &&
        unit.team === target.team &&
        unit.lane === target.lane &&
        unit.guardPoints > 0 &&
        bearsShield(unit) &&
        // In front of the target, with the shooter in front of it in turn.
        (unit.positionX - target.positionX) * facing(target) > 1e-9 &&
        inFront(unit, attacker.positionX),
    )
    .sort(
      (a, b) => Math.abs(a.positionX - target.positionX) - Math.abs(b.positionX - target.positionX),
    )[0];
}
