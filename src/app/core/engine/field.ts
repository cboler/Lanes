import { AbilityDefinition } from '../models/ability.model';
import { UnitInstance } from '../models/unit-instance.model';

/*
 * The battlefield's geometry: where units may stand, how close lane-mates may get, and
 * how far a melee weapon reaches. Positions are fractions of the field's width.
 */

export const FIELD_MIN_X = 0.05;
export const FIELD_MAX_X = 0.95;
/** The closest two units in one lane may stand. */
export const COLLISION_BUFFER = 0.08;
/** Move Gauge spent per full battlefield width travelled. */
export const MOVE_COST_PER_FIELD = 50;
/** How far one step of melee range reaches; a Fighter has 1, a Lancer's polearm 2. */
const REACH_PER_RANGE = 0.18;

/** How far along its lane a melee unit can strike. */
export function meleeReach(unit: UnitInstance): number {
  return REACH_PER_RANGE * unit.stats.meleeRange;
}

/** Melee skills aimed at enemies must reach them; shots, spells and party-wide skills need not. */
export function needsReach(unit: UnitInstance, ability: AbilityDefinition): boolean {
  return (
    unit.classDef.archetype === 'melee' &&
    ability.target.includes('enem') &&
    ability.target !== 'all-enemies'
  );
}

export function inReach(unit: UnitInstance, target: UnitInstance): boolean {
  return Math.abs(target.positionX - unit.positionX) <= meleeReach(unit) + 1e-9;
}

/**
 * How far `unit` can slide in direction `dir` (+1 or -1) along its lane before it meets
 * the field's edge or a lane-mate.
 */
export function slideRoom(unit: UnitInstance, dir: number, units: readonly UnitInstance[]): number {
  let limit = dir > 0 ? FIELD_MAX_X : FIELD_MIN_X;
  for (const other of units) {
    if (other === unit || !other.isAlive || other.lane !== unit.lane) continue;
    const ahead = (other.positionX - unit.positionX) * dir;
    if (ahead <= 0) continue;
    const stop = other.positionX - dir * COLLISION_BUFFER;
    limit = dir > 0 ? Math.min(limit, stop) : Math.max(limit, stop);
  }
  return Math.max(0, (limit - unit.positionX) * dir);
}
