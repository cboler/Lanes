import { ACHIEVEMENTS } from './aggregate';
import { PROFILES, ProfileId } from './profiles';
import type { Report } from './report';

/*
 * The report as flat tables of rows, one JSON file each, ready to load into a
 * spreadsheet or the simulations dashboard. Rates are percentages rounded to one decimal.
 */

const pct = (share: number) => Math.round(share * 1000) / 10;
const label = (profile: string) => PROFILES[profile as ProfileId]?.label ?? profile;

export function datasets(report: Report): Record<string, object[]> {
  const out: Record<string, object[]> = {};
  const summary: { metric: string; label: string; value: number }[] = [
    { metric: 'battles', label: 'Battles simulated', value: report.battles },
    { metric: 'seconds', label: 'Run time (s)', value: Math.round(report.ms / 100) / 10 },
    { metric: 'perCell', label: 'Battles per cell', value: report.size },
    { metric: 'seed', label: 'Seed', value: report.seed },
  ];
  if (report.sides) {
    const { mirrors, random } = report.sides;
    summary.push(
      {
        metric: 'mirrorWins',
        label: 'Mirror matches won by the player side (%)',
        value: pct(mirrors.winRate),
      },
      { metric: 'mirrorBattles', label: 'Mirror matches', value: mirrors.battles },
      {
        metric: 'firstMoverWins',
        label: 'Battles won by the side that moved first (%)',
        value: pct(random.firstMoverWins),
      },
      { metric: 'randomBattles', label: 'Random 4v4 battles', value: random.battles },
      {
        metric: 'avgRounds',
        label: 'Average rounds (random 4v4)',
        value: Math.round(random.avgRounds * 10) / 10,
      },
      {
        metric: 'timedOut',
        label: 'Random 4v4 decided on time (%)',
        value: pct(random.timedOut / Math.max(1, random.battles)),
      },
      {
        metric: 'stalls',
        label: 'Battles that never ended',
        value: mirrors.stalls + random.stalls,
      },
    );
  }
  out['summary'] = summary;

  if (report.classes) {
    const dmg = report.damagePerUnit ?? {};
    out['classes'] = Object.entries(report.classes).map(([cls, { winRate, battles }]) => ({
      class: cls[0].toUpperCase() + cls.slice(1),
      squadWinRate: pct(winRate),
      squads: battles,
      damageYours: dmg[`player:${cls}`] ?? 0,
      damageEnemy: dmg[`enemy:${cls}`] ?? 0,
    }));
  }
  if (report.skills) {
    out['skills'] = Object.entries(report.skills).map(([skill, s]) => ({
      skill,
      uses: s.uses,
      damagePerUse: s.perUse,
      kills: s.kills,
    }));
  }
  if (report.contracts) {
    out['contracts'] = report.contracts.map((c) => ({
      level: c.level,
      tier: c.tier,
      gear: c.gear,
      player: label(c.profile),
      winRate: pct(c.winRate),
      avgRounds: Math.round(c.avgRounds * 10) / 10,
      timedOut: c.timedOut,
      battles: c.battles,
    }));
  }
  if (report.campaign) {
    const order = [...new Set(report.campaign.map((c) => c.mission))];
    out['campaign'] = report.campaign.map((c) => ({
      step: order.indexOf(c.mission) + 1,
      mission: c.title,
      level: c.level,
      gear: c.gear,
      player: label(c.profile),
      winRate: pct(c.winRate),
      avgRounds: Math.round(c.avgRounds * 10) / 10,
      battles: c.battles,
    }));
  }
  if (report.achievements) {
    out['achievements'] = ACHIEVEMENTS.map((a) => ({
      achievement: a.name,
      rule: a.rule,
      ...Object.fromEntries(
        Object.entries(report.achievements!).map(([profile, rates]) => [
          label(profile),
          pct(rates[a.id]),
        ]),
      ),
    }));
  }
  if (report.biggestHit) {
    out['hits'] = Object.entries(report.biggestHit).map(([percentile, damage]) => ({
      percentile: Number(percentile.slice(1)),
      damage,
    }));
  }
  return out;
}
