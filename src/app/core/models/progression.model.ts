import { ALL_CLASSES } from './unit-class.model';
import {
  GRADES,
  Grade,
  Mercenary,
  PRIMARY_STATS,
  PrimaryStat,
  Random,
  generateMercenary,
} from './mercenary.model';

/*
 * Grand Kingdom's progression loop: battles pay gold and EXP, a level-up grants stat
 * points, and aptitude decides how well invested points pay off. Gold hires recruits,
 * whose random aptitudes are the reason to keep checking the board.
 */

export const LEVEL_CAP = 50;
export const POINTS_PER_LEVEL = 5;
export const SP_PER_LEVEL = 1;
export const STARTING_GOLD = 500;
export const ROSTER_LIMIT = 12;
export const RECRUIT_COUNT = 3;
export const REFRESH_COST = 20;

/** Points invested per bonus point: an S stat earns one every 2, an F stat every 8. */
export const APTITUDE_RATIO: Record<Grade, number> = { S: 2, A: 3, B: 4, C: 5, D: 6, E: 7, F: 8 };

/** EXP needed to go from `level` to the next. */
export function expToNext(level: number): number {
  return 60 + 40 * level;
}

/** How a battle ended, as the rewards need it. Published by the battle when it ends. */
export interface BattleReport {
  readonly id: string;
  readonly outcome: 'victory' | 'defeat';
  readonly enemiesDefeated: number;
  /** The player's roster mercenaries in the battle, and whether each was standing at the end. */
  readonly mercenaries: readonly { readonly id: string; readonly survived: boolean }[];
}

export interface MercenaryReward {
  readonly id: string;
  readonly name: string;
  readonly exp: number;
  readonly level: number;
  readonly levelsGained: number;
  /** Names of pattern skills learned by the levels gained. */
  readonly learned: readonly string[];
}

export interface BattleRewards {
  readonly gold: number;
  readonly mercenaries: readonly MercenaryReward[];
}

export function battleGold(report: BattleReport): number {
  return (report.outcome === 'victory' ? 100 : 20) + 20 * report.enemiesDefeated;
}

/** EXP for one mercenary: half if it fell, and TEC raises it (spec 1.2.1), 2% per point from 17. */
export function battleExp(report: BattleReport, merc: Mercenary, survived: boolean): number {
  const base = (report.outcome === 'victory' ? 50 : 20) + 15 * report.enemiesDefeated;
  const learning = Math.max(0.5, 1 + (merc.stats.tec - 17) * 0.02);
  return Math.max(1, Math.floor(base * (survived ? 1 : 0.5) * learning));
}

/** Adds EXP, levelling up as often as it pays for: each level grants stat points and SP. */
export function gainExp(merc: Mercenary, amount: number): Mercenary {
  const next = structuredClone(merc);
  next.exp += amount;
  while (next.level < LEVEL_CAP && next.exp >= expToNext(next.level)) {
    next.exp -= expToNext(next.level);
    next.level += 1;
    next.statPoints += POINTS_PER_LEVEL;
    next.stats.sp += SP_PER_LEVEL;
  }
  if (next.level >= LEVEL_CAP) next.exp = 0;
  return next;
}

/** Invests one point: +1 to the stat, plus a bonus point each time its aptitude's ratio fills. */
export function investPoint(merc: Mercenary, stat: PrimaryStat): Mercenary | null {
  if (merc.statPoints < 1) return null;
  const next = structuredClone(merc);
  next.statPoints -= 1;
  next.invested[stat] += 1;
  next.stats[stat] += next.invested[stat] % APTITUDE_RATIO[next.aptitudes[stat]] === 0 ? 2 : 1;
  return next;
}

/** Better aptitudes cost more: 100 gold plus 5 per grade step above F, across all eight. */
export function hireCost(merc: Mercenary): number {
  return (
    100 + 5 * PRIMARY_STATS.reduce((sum, stat) => sum + GRADES.indexOf(merc.aptitudes[stat]), 0)
  );
}

/** A fresh board of recruits of random classes, avoiding names already taken. */
export function generateRecruits(random: Random, takenNames: readonly string[]): Mercenary[] {
  const recruits: Mercenary[] = [];
  for (let i = 0; i < RECRUIT_COUNT; i++) {
    const cls = ALL_CLASSES[Math.floor(random() * ALL_CLASSES.length)];
    recruits.push(
      generateMercenary(cls.id, random, [...takenNames, ...recruits.map((r) => r.name)]),
    );
  }
  return recruits;
}
