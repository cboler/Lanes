import type { BattleReport } from './progression.model';
import type { UnitInstance } from './unit-instance.model';

/*
 * Squad bonds: every two mercenaries share a bond that grows as they fight together, and
 * faster when one answers the other's call or tends their wounds. Each rank unlocks a
 * perk the pair has whenever both take the field:
 *   Comrades  +10% damage while the two share a lane (two partners at most count);
 *   Trusted   an assist one calls and the other answers hits 30% harder;
 *   Sworn     when one falls, the other is spurred to vengeance (+25 Attack, 3 turns).
 * Pure and deterministic, so battles replay the same way.
 */

export interface BondRank {
  readonly rank: 1 | 2 | 3;
  readonly points: number;
  readonly title: string;
  readonly perk: string;
}

export const BOND_RANKS: readonly BondRank[] = [
  { rank: 1, points: 20, title: 'Comrades', perk: '+10% damage while sharing a lane' },
  { rank: 2, points: 60, title: 'Trusted', perk: 'Assists between them hit 30% harder' },
  { rank: 3, points: 120, title: 'Sworn', perk: 'Vengeance: +25 Attack when the other falls' },
];

/** Bond points by pair key (two mercenary ids, sorted, joined by '|'). */
export type Bonds = Readonly<Record<string, number>>;

export const SHARED_LANE_BONUS = 0.1;
export const TRUSTED_ASSIST_POWER = 1.3;
export const VENGEANCE = { type: 'attack-up', duration: 3, potency: 25 } as const;

export function bondKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function bondRank(points: number): 0 | 1 | 2 | 3 {
  let rank: 0 | 1 | 2 | 3 = 0;
  for (const step of BOND_RANKS) if (points >= step.points) rank = step.rank;
  return rank;
}

/** The next rank's threshold, or null at Sworn. */
export function nextBondRank(points: number): BondRank | null {
  return BOND_RANKS.find((step) => points < step.points) ?? null;
}

/** What a battle did for each pair of mercenaries who fought in it. */
export function bondGains(report: BattleReport): Record<string, number> {
  const gains: Record<string, number> = {};
  const add = (a: string, b: string, points: number) => {
    if (a === b) return;
    const key = bondKey(a, b);
    gains[key] = (gains[key] ?? 0) + points;
  };
  const fought = report.mercenaries;
  for (let i = 0; i < fought.length; i++) {
    for (let j = i + 1; j < fought.length; j++) {
      const both = fought[i].survived && fought[j].survived;
      add(fought[i].id, fought[j].id, (report.outcome === 'victory' ? 6 : 3) + (both ? 2 : 0));
    }
  }
  for (const [caller, ally] of report.assists ?? []) add(caller, ally, 4);
  // Tending wounds counts, but only so much per battle.
  const tended: Record<string, number> = {};
  for (const [healer, patient] of report.heals ?? []) {
    const key = bondKey(healer, patient);
    if ((tended[key] = (tended[key] ?? 0) + 1) <= 3) add(healer, patient, 2);
  }
  return gains;
}

/** A pair that reached a new rank. */
export interface BondRankUp {
  readonly ids: readonly [string, string];
  readonly rank: BondRank;
}

export function applyBondGains(
  bonds: Bonds,
  gains: Record<string, number>,
): { bonds: Bonds; rankUps: BondRankUp[] } {
  const next: Record<string, number> = { ...bonds };
  const rankUps: BondRankUp[] = [];
  for (const [key, points] of Object.entries(gains)) {
    const before = next[key] ?? 0;
    next[key] = before + points;
    const rank = bondRank(next[key]);
    if (rank > bondRank(before)) {
      const [a, b] = key.split('|') as [string, string];
      rankUps.push({ ids: [a, b], rank: BOND_RANKS[rank - 1] });
    }
  }
  return { bonds: next, rankUps };
}

/** Keeps only whole, positive points for pairs of mercenaries still in the roster. */
export function parseBonds(value: unknown, rosterIds: readonly string[]): Bonds {
  const bonds: Record<string, number> = {};
  if (!value || typeof value !== 'object') return bonds;
  for (const [key, points] of Object.entries(value)) {
    const [a, b, extra] = key.split('|');
    if (
      extra === undefined &&
      rosterIds.includes(a) &&
      rosterIds.includes(b) &&
      a !== b &&
      Number.isInteger(points) &&
      points > 0 &&
      points <= 99999
    ) {
      bonds[bondKey(a, b)] = points;
    }
  }
  return bonds;
}

/** A unit's bond with another unit on its side, as a battle uses it. */
export interface BondLink {
  readonly partner: UnitInstance;
  readonly rank: number;
}

/** Damage multiplier from Comrades (or better) partners standing in the attacker's lane. */
export function bondPower(attacker: UnitInstance): number {
  const sharing = attacker.bonds.filter(
    (link) => link.rank >= 1 && link.partner.isAlive && link.partner.lane === attacker.lane,
  ).length;
  return 1 + SHARED_LANE_BONUS * Math.min(2, sharing);
}

export function bondRankWith(unit: UnitInstance, other: UnitInstance): number {
  return unit.bonds.find((link) => link.partner === other)?.rank ?? 0;
}
