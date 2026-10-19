import { AbilityStatus } from './ability.model';
import { StatusEffectInstance, StatusEffectType } from './status-effect.model';
import { UnitBaseStats } from './stats.model';
import { BARRICADE_CLASS } from './unit-class.model';
import { Team, UnitInstance } from './unit-instance.model';

/*
 * Battlefield objects (spec 1.1.5): barricades that block a lane until broken, and traps
 * that spring on an enemy who walks over them or is knocked into them. A contract's band
 * raises them before the battle.
 */

export type TrapKind = 'spikes' | 'snare';

/** Where a band places an object, as saved with its contract. */
export type FieldObjectSpec =
  | { readonly kind: 'barricade'; readonly lane: number; readonly x: number }
  | { readonly kind: 'trap'; readonly trap: TrapKind; readonly lane: number; readonly x: number };

/** A live trap on the field. It belongs to the side that set it and springs on the other. */
export interface FieldTrap {
  readonly id: string;
  readonly kind: TrapKind;
  readonly team: Team;
  readonly lane: number;
  readonly x: number;
  readonly damage: number;
  readonly status: AbilityStatus;
}

export const TRAP_NAMES: Record<TrapKind, string> = { spikes: 'Spike trap', snare: 'Snare' };

/** How close a unit must pass to a trap to spring it. */
const TRAP_REACH = 0.02;

/** A barricade's sheet at a contract level: sturdier the stronger the band. */
export function barricadeStats(level: number): UnitBaseStats {
  const base = BARRICADE_CLASS.baseStats;
  return {
    ...base,
    maxHp: base.maxHp + 30 * (level - 1),
    defense: base.defense + 3 * (level - 1),
    magicDefense: base.magicDefense + 3 * (level - 1),
  };
}

/** Spikes wound and poison; a snare bites less but holds its victim for a turn. */
export function makeTrap(
  spec: Extract<FieldObjectSpec, { kind: 'trap' }>,
  team: Team,
  level: number,
  id: string,
): FieldTrap {
  const spikes = spec.trap === 'spikes';
  return {
    id,
    kind: spec.trap,
    team,
    lane: spec.lane,
    x: spec.x,
    damage: spikes ? 20 + 4 * (level - 1) : 15 + 3 * (level - 1),
    status: spikes
      ? { type: 'poison', duration: 3, potency: 8 + level }
      : { type: 'stun', duration: 1, potency: 0 },
  };
}

/** The traps set by `unit`'s enemies that it passes over moving along its lane from `fromX` to `toX`. */
export function trapsCrossed(
  traps: readonly FieldTrap[],
  unit: UnitInstance,
  fromX: number,
  toX: number,
): FieldTrap[] {
  const low = Math.min(fromX, toX) - TRAP_REACH;
  const high = Math.max(fromX, toX) + TRAP_REACH;
  return traps.filter(
    (trap) => trap.team !== unit.team && trap.lane === unit.lane && trap.x >= low && trap.x <= high,
  );
}

/** Springs a trap on a unit: its damage (Guard still absorbs it) and its status. */
export function springTrap(
  trap: FieldTrap,
  unit: UnitInstance,
): { damage: number; status: StatusEffectType; defeated: boolean } {
  const damage = unit.takeDamage(trap.damage);
  if (unit.isAlive) {
    unit.refreshStatusEffect(
      new StatusEffectInstance(trap.status.type, trap.status.duration, trap.status.potency),
    );
  }
  return { damage, status: trap.status.type, defeated: !unit.isAlive };
}

/** Validates a saved object placement, or null. */
export function parseObjectSpec(value: unknown): FieldObjectSpec | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { kind?: unknown; trap?: unknown; lane?: unknown; x?: unknown };
  if (
    !Number.isInteger(raw.lane) ||
    (raw.lane as number) < 0 ||
    (raw.lane as number) > 2 ||
    typeof raw.x !== 'number' ||
    raw.x < 0.05 ||
    raw.x > 0.95
  )
    return null;
  const lane = raw.lane as number;
  if (raw.kind === 'barricade') return { kind: 'barricade', lane, x: raw.x };
  if (raw.kind === 'trap' && (raw.trap === 'spikes' || raw.trap === 'snare')) {
    return { kind: 'trap', trap: raw.trap, lane, x: raw.x };
  }
  return null;
}
