import { mkdirSync, writeFileSync } from 'node:fs';
import { it, vi } from 'vitest';
import { seededRandom } from '../src/app/core/models/mercenary.model';
import { findMission } from '../src/app/core/models/campaign.model';
import {
  achievementRates,
  allRecords,
  classWinRates,
  damagePerUnit,
  percentiles,
  skillTable,
  summarize,
} from './aggregate';
import { Cell, campaign, classBalance, contracts, mirrors } from './scenarios';
import { Report, renderHtml } from './report';
import { datasets } from './datasets';

/*
 * Entry point for `npm run sim`. Settings come from the environment:
 *   SIM_SEED       the random seed (default 1); the same seed gives the same report
 *   SIM_SIZE       battles per cell of each grid (default 40)
 *   SIM_SCENARIOS  any of classes,contracts,campaign (default all)
 * Writes sim-results/report.json, sim-results/report.html, and one table of rows per
 * section in sim-results/data/ (for a spreadsheet or the simulations dashboard).
 */

const seed = Number(process.env['SIM_SEED'] ?? 1);
const size = Math.max(1, Number(process.env['SIM_SIZE'] ?? 40));
const wanted = (process.env['SIM_SCENARIOS'] ?? 'classes,contracts,campaign').split(',');

it(
  'simulates battles and writes the report',
  () => {
    // Settings the battle reads (speed, timing) come from storage; start every run clean.
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    // Read the clock before faking it: fake timers stop Date too.
    const started = Date.now();
    const generated = new Date().toISOString();
    vi.useFakeTimers();
    const random = seededRandom(seed);
    let report: Report = {
      generated,
      seed,
      size,
      battles: 0,
      ms: 0,
    };
    const cells: Cell[] = [];

    if (wanted.includes('classes')) {
      const random4v4 = classBalance(size * 10, random);
      const mirror = mirrors(size * 5, random);
      cells.push(random4v4, mirror);
      const r = summarize(random4v4.records);
      const m = summarize(mirror.records);
      report = {
        ...report,
        sides: {
          mirrors: {
            winRate: m.winRate,
            battles: m.battles,
            stalls: m.stalls,
            timedOut: m.timedOut,
          },
          random: {
            winRate: r.winRate,
            battles: r.battles,
            stalls: r.stalls,
            timedOut: r.timedOut,
            avgRounds: r.avgRounds,
            firstMoverWins: r.firstMoverWins,
          },
        },
        classes: classWinRates(random4v4.records),
      };
    }

    const playerCells: Cell[] = [];
    if (wanted.includes('contracts')) {
      const grid = contracts(size, random);
      playerCells.push(...grid);
      report = {
        ...report,
        contracts: grid.map((cell) => {
          const s = summarize(cell.records);
          return {
            level: cell.level!,
            tier: cell.tier!,
            gear: cell.gear!,
            profile: cell.profile,
            winRate: s.winRate,
            avgRounds: s.avgRounds,
            strengthOnWin: s.strengthOnWin,
            timedOut: s.timedOut,
            stalls: s.stalls,
            battles: s.battles,
          };
        }),
      };
    }
    if (wanted.includes('campaign')) {
      const grid = campaign(size, random);
      playerCells.push(...grid);
      report = {
        ...report,
        campaign: grid.map((cell) => {
          const s = summarize(cell.records);
          return {
            mission: cell.mission!,
            title: findMission(cell.mission!)?.title ?? cell.mission!,
            level: cell.level!,
            gear: cell.gear!,
            profile: cell.profile,
            winRate: s.winRate,
            avgRounds: s.avgRounds,
            battles: s.battles,
          };
        }),
      };
    }
    cells.push(...playerCells);

    const everything = allRecords(cells);
    if (playerCells.length) {
      const byProfile: Record<string, Record<string, number>> = {};
      for (const profile of [...new Set(playerCells.map((c) => c.profile))]) {
        byProfile[profile] = achievementRates(
          allRecords(playerCells.filter((c) => c.profile === profile)),
        );
      }
      report = {
        ...report,
        achievements: byProfile,
        biggestHit: percentiles(allRecords(playerCells).map((r) => r.biggestHit)),
      };
    }
    report = {
      ...report,
      damagePerUnit: damagePerUnit(everything),
      skills: skillTable(everything),
      battles: everything.length,
    };
    vi.useRealTimers();
    report = { ...report, ms: Date.now() - started };

    mkdirSync('sim-results', { recursive: true });
    writeFileSync('sim-results/report.json', JSON.stringify(report, null, 2));
    writeFileSync('sim-results/report.html', renderHtml(report));
    mkdirSync('sim-results/data', { recursive: true });
    for (const [name, rows] of Object.entries(datasets(report))) {
      writeFileSync(`sim-results/data/${name}.json`, JSON.stringify(rows, null, 2));
    }

    const all = summarize(everything);
    const lines = [
      `Simulated ${everything.length} battles in ${(report.ms / 1000).toFixed(1)} s (seed ${seed}, ${size} per cell).`,
      `Never ended: ${all.stalls} · timed out: ${all.timedOut} · average rounds ${all.avgRounds.toFixed(1)}`,
    ];
    if (report.sides) {
      lines.push(
        `Mirror matches won by the player side: ${Math.round(report.sides.mirrors.winRate * 100)}% of ${report.sides.mirrors.battles}`,
      );
    }
    lines.push('Report: sim-results/report.html (data: sim-results/report.json)');
    process.stdout.write(`\n${lines.join('\n')}\n\n`);
  },
  30 * 60 * 1000,
);
