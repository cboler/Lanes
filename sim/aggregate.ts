import type { BattleRecord } from './battle';
import type { Cell } from './scenarios';

/*
 * Turns battle records into the numbers the report shows: win rates, battle length,
 * class and skill balance, and how often candidate achievements would unlock.
 */

export interface Summary {
  readonly battles: number;
  readonly winRate: number;
  readonly stalls: number;
  readonly timedOut: number;
  readonly avgRounds: number;
  /** The player's strength left, averaged over wins. */
  readonly strengthOnWin: number;
  readonly fallenPerBattle: number;
  readonly firstMoverWins: number;
}

const mean = (values: readonly number[]) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

export function summarize(records: readonly BattleRecord[]): Summary {
  const wins = records.filter((r) => r.outcome === 'victory');
  const decided = records.filter((r) => r.outcome !== 'stalled');
  return {
    battles: records.length,
    winRate: records.length ? wins.length / records.length : 0,
    stalls: records.filter((r) => r.outcome === 'stalled').length,
    timedOut: records.filter((r) => r.timedOut).length,
    avgRounds: mean(records.map((r) => r.rounds)),
    strengthOnWin: mean(wins.map((r) => r.strengthLeft.player)),
    fallenPerBattle: mean(records.map((r) => r.playerFallen)),
    firstMoverWins: decided.length
      ? decided.filter((r) => (r.first === 'player') === (r.outcome === 'victory')).length /
        decided.length
      : 0,
  };
}

/** Candidate achievements: a test on one battle, for sizing how rare each would be. */
export const ACHIEVEMENTS: readonly {
  readonly id: string;
  readonly name: string;
  readonly rule: string;
  readonly test: (r: BattleRecord) => boolean;
}[] = [
  {
    id: 'flawless',
    name: 'Flawless',
    rule: 'Win without losing anyone',
    test: (r) => r.outcome === 'victory' && r.playerFallen === 0,
  },
  {
    id: 'last-stand',
    name: 'Last One Standing',
    rule: 'Win with one mercenary left',
    test: (r) => r.outcome === 'victory' && r.playerUnits - r.playerFallen === 1,
  },
  {
    id: 'blitz',
    name: 'Blitz',
    rule: 'Win within 2 rounds',
    test: (r) => r.outcome === 'victory' && r.rounds <= 2,
  },
  {
    id: 'nail-biter',
    name: 'Nail-Biter',
    rule: 'Win with under 25% of your strength left',
    test: (r) => r.outcome === 'victory' && r.strengthLeft.player < 0.25,
  },
  {
    id: 'on-time',
    name: 'Hold the Field',
    rule: 'Win when time runs out',
    test: (r) => r.outcome === 'victory' && r.timedOut,
  },
  {
    id: 'shield-wall',
    name: 'Shield Wall',
    rule: 'Your shields block 60+ damage in one battle',
    test: (r) => r.shields.player.blocked >= 60,
  },
  {
    id: 'sheltered',
    name: 'Sheltered',
    rule: 'A guarding Fighter covers allies twice in one battle',
    test: (r) => r.shields.player.covers >= 2,
  },
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    rule: '3 critical shots in one battle',
    test: (r) => (r.grades['critical'] ?? 0) >= 3,
  },
  {
    id: 'just-cancel',
    name: 'Just Right',
    rule: '3 Just Cancels in one battle',
    test: (r) => (r.grades['just'] ?? 0) >= 3,
  },
  {
    id: 'reaper',
    name: 'Reaper',
    rule: 'One mercenary fells 3 enemies in one battle',
    test: (r) => r.topKills >= 3,
  },
  {
    id: 'heavy-hitter',
    name: 'Heavy Hitter',
    rule: 'One blow of 150+ damage',
    test: (r) => r.biggestHit >= 150,
  },
];

export function achievementRates(records: readonly BattleRecord[]): Record<string, number> {
  return Object.fromEntries(
    ACHIEVEMENTS.map((a) => [
      a.id,
      records.length ? records.filter(a.test).length / records.length : 0,
    ]),
  );
}

/** Percentiles of a list, for spotting where a threshold would bite. */
export function percentiles(values: readonly number[], points = [50, 75, 90, 99]) {
  const sorted = [...values].sort((a, b) => a - b);
  return Object.fromEntries(
    points.map((p) => [
      `p${p}`,
      sorted.length
        ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
        : 0,
    ]),
  );
}

/** How often a squad that fielded each class won (class troops only). */
export function classWinRates(records: readonly BattleRecord[]) {
  const tally: Record<string, { wins: number; battles: number }> = {};
  for (const r of records) {
    if (r.outcome === 'stalled') continue;
    for (const [classes, won] of [
      [r.playerClasses, r.outcome === 'victory'],
      [r.enemyClasses, r.outcome === 'defeat'],
    ] as const) {
      for (const cls of new Set(classes)) {
        const entry = (tally[cls] ??= { wins: 0, battles: 0 });
        entry.battles++;
        if (won) entry.wins++;
      }
    }
  }
  return Object.fromEntries(
    Object.entries(tally)
      .sort()
      .map(([cls, { wins, battles }]) => [cls, { winRate: wins / battles, battles }]),
  );
}

/** Damage dealt per unit fielded, by class and side. */
export function damagePerUnit(records: readonly BattleRecord[]) {
  const dealt: Record<string, number> = {};
  const fielded: Record<string, number> = {};
  for (const r of records) {
    for (const [key, amount] of Object.entries(r.damageByClass))
      dealt[key] = (dealt[key] ?? 0) + amount;
    for (const cls of r.playerClasses)
      fielded[`player:${cls}`] = (fielded[`player:${cls}`] ?? 0) + 1;
    for (const cls of r.enemyClasses) fielded[`enemy:${cls}`] = (fielded[`enemy:${cls}`] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.keys(fielded)
      .sort()
      .map((key) => [key, Math.round((dealt[key] ?? 0) / fielded[key])]),
  );
}

/** Uses, damage per use and kills for every skill seen. */
export function skillTable(records: readonly BattleRecord[]) {
  const table: Record<string, { uses: number; damage: number; kills: number }> = {};
  for (const r of records) {
    for (const [id, s] of Object.entries(r.skills)) {
      const entry = (table[id] ??= { uses: 0, damage: 0, kills: 0 });
      entry.uses += s.uses;
      entry.damage += s.damage;
      entry.kills += s.kills;
    }
  }
  return Object.fromEntries(
    Object.entries(table)
      .sort((a, b) => b[1].uses - a[1].uses)
      .map(([id, s]) => [
        id,
        { uses: s.uses, perUse: s.uses ? Math.round(s.damage / s.uses) : 0, kills: s.kills },
      ]),
  );
}

export const allRecords = (cells: readonly Cell[]) => cells.flatMap((cell) => cell.records);
