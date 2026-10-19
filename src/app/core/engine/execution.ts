import { AbilityDefinition } from '../models/ability.model';
import { UnitInstance } from '../models/unit-instance.model';

/*
 * Interactive execution from Grand Kingdom: ranged and magic skills are fired with a
 * sweeping point-of-impact cursor, and melee skills chain into combos with a Just Cancel
 * window. The player's timing becomes a grade before the rules run; the rules only ever
 * see the grade, so AI, defense orders and replays stay deterministic by passing none.
 */

/** How the player executes a skill: aim a sweeping cursor, chain a combo, or neither. */
export type ExecutionKind = 'aim' | 'combo' | 'none';

export type AimGrade = 'critical' | 'hit' | 'graze' | 'miss';
export type ChainGrade = 'chain' | 'just';
export type ExecutionGrade = AimGrade | ChainGrade;

/** Damage multiplier for each grade, applied after defense. No grade means 1. */
export const GRADE_POWER: Record<ExecutionGrade, number> = {
  critical: 1.3,
  hit: 1,
  graze: 0.5,
  miss: 0,
  chain: 1.1,
  just: 1.3,
};

/** Half-widths of the aim zones around their centre, as fractions of the track. */
export const AIM_ZONES = { critical: 0.035, hit: 0.12, graze: 0.22 } as const;

/** Combo timing at 1x speed, in ms after the previous skill resolved. Matches the stage's melee beat. */
export const CHAIN_WINDOW = {
  /** The strike lands; a press before this is ignored. */
  open: 420,
  /** The white flash: a press inside it is a Just Cancel. */
  justFrom: 560,
  justTo: 760,
  /** The attack has recovered; the combo is over. */
  close: 1150,
} as const;

export function executionKind(unit: UnitInstance, ability: AbilityDefinition): ExecutionKind {
  if (ability.damageType === 'healing' || ability.powerMultiplier === 0) return 'none';
  return unit.classDef.archetype === 'melee' ? 'combo' : 'aim';
}

/** How long the cursor takes to cross the track: heavier skills sweep faster. */
export function aimSweepMs(ability: AbilityDefinition): number {
  return 1500 - ability.actionCost * 10;
}

/**
 * Where the target sits on the track. The track is the ground ahead of the attacker,
 * so farther targets (and other lanes) sit later in the sweep.
 */
export function aimZoneCenter(attacker: UnitInstance, targets: readonly UnitInstance[]): number {
  if (!targets.length) return 0.5;
  const reach =
    targets.reduce(
      (sum, t) =>
        sum + Math.abs(t.positionX - attacker.positionX) + Math.abs(t.lane - attacker.lane) * 0.08,
      0,
    ) / targets.length;
  return Math.min(0.88, Math.max(0.3, 0.3 + reach * 0.65));
}

/** Grades a press at `cursor` (0 at the start of the track, 1 at its end). */
export function aimGrade(cursor: number, center: number): AimGrade {
  const off = Math.abs(cursor - center);
  if (off <= AIM_ZONES.critical) return 'critical';
  if (off <= AIM_ZONES.hit) return 'hit';
  if (off <= AIM_ZONES.graze) return 'graze';
  return 'miss';
}

/**
 * Grades a chain press `elapsed` ms after the previous skill. 'early' is ignored by the
 * caller; null means the window has closed. `speed` scales the window with the animation.
 */
export function chainGrade(elapsed: number, speed = 1): ChainGrade | 'early' | null {
  if (elapsed < CHAIN_WINDOW.open * speed) return 'early';
  if (elapsed > CHAIN_WINDOW.close * speed) return null;
  return elapsed >= CHAIN_WINDOW.justFrom * speed && elapsed <= CHAIN_WINDOW.justTo * speed
    ? 'just'
    : 'chain';
}
