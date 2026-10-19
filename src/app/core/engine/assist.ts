import { AbilityDefinition } from '../models/ability.model';
import { Team, UnitInstance } from '../models/unit-instance.model';
import { CombatExecutor, TargetEffect } from './combat-executor';

/*
 * Grand Kingdom's assist gauge (spec 1.1.5): each side's gauge fills as it deals damage
 * and defeats enemies. Spending an orb calls an ally's pursuit attack outside its turn,
 * free of AP, to finish a weakened enemy or add damage on a key turn.
 */

/** Points per orb; the troop banner shows three. */
export const ASSIST_COST = 100;
export const ASSIST_MAX = 3 * ASSIST_COST;
/** Extra points for each enemy defeated. */
const DEFEAT_BONUS = 25;

/** What one resolved skill adds to its side's gauge: half the damage dealt to enemies, plus defeats. */
export function assistGain(effects: readonly TargetEffect[]): number {
  let gain = 0;
  for (const effect of effects) {
    if (effect.isHealing || effect.isFriendlyFire || effect.missed) continue;
    gain += Math.floor(effect.amount / 2) + (effect.wasDefeated ? DEFEAT_BONUS : 0);
  }
  return gain;
}

/** One ally's pursuit attack, as it would land now. */
export interface AssistPlan {
  readonly ally: UnitInstance;
  readonly ability: AbilityDefinition;
  /** Who it hits: the first of `targets`, or every one for an area skill. */
  readonly targets: readonly UnitInstance[];
}

/**
 * The pursuit an ally would make: its first damaging skill (its basic attack), at the
 * preferred target when it can reach it, otherwise the weakest enemy it can reach.
 */
export function pursuitFor(
  ally: UnitInstance,
  units: readonly UnitInstance[],
  preferredId: string | null = null,
): AssistPlan | null {
  if (!ally.isAlive || ally.isStunned) return null;
  const ability = ally.abilities.find(
    (a) => a.powerMultiplier > 0 && a.damageType !== 'healing' && a.target.includes('enem'),
  );
  if (!ability) return null;
  const valid = CombatExecutor.getValidTargets(ally, ability, units);
  if (!valid.length) return null;
  if (!ability.target.startsWith('single-')) return { ally, ability, targets: valid };
  const target =
    valid.find((unit) => unit.id === preferredId) ??
    [...valid].sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0];
  return { ally, ability, targets: [target] };
}

/** Every ally of the acting unit who could answer a call now. */
export function assistCandidates(
  active: UnitInstance,
  units: readonly UnitInstance[],
  preferredId: string | null = null,
): AssistPlan[] {
  return units
    .filter((unit) => unit.team === active.team && unit !== active)
    .map((ally) => pursuitFor(ally, units, preferredId))
    .filter((plan): plan is AssistPlan => !!plan);
}

export type AssistGauges = Readonly<Record<Team, number>>;
