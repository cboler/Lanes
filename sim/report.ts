import { ACHIEVEMENTS } from './aggregate';
import { PROFILES } from './profiles';

/*
 * The simulation report as one self-contained HTML page: no scripts, no network, so it
 * opens straight from disk and can be shared as is.
 */

export interface Report {
  readonly generated: string;
  readonly seed: number;
  readonly size: number;
  readonly battles: number;
  readonly ms: number;
  readonly sides?: {
    readonly mirrors: { winRate: number; battles: number; stalls: number; timedOut: number };
    readonly random: {
      winRate: number;
      battles: number;
      stalls: number;
      timedOut: number;
      avgRounds: number;
      firstMoverWins: number;
    };
  };
  readonly classes?: Record<string, { winRate: number; battles: number }>;
  readonly damagePerUnit?: Record<string, number>;
  readonly skills?: Record<string, { uses: number; perUse: number; kills: number }>;
  readonly contracts?: {
    readonly level: number;
    readonly tier: string;
    readonly gear: string;
    readonly profile: string;
    readonly winRate: number;
    readonly avgRounds: number;
    readonly strengthOnWin: number;
    readonly timedOut: number;
    readonly stalls: number;
    readonly battles: number;
  }[];
  readonly campaign?: {
    readonly mission: string;
    readonly title: string;
    readonly level: number;
    readonly gear: string;
    readonly profile: string;
    readonly winRate: number;
    readonly avgRounds: number;
    readonly battles: number;
  }[];
  readonly achievements?: Record<string, Record<string, number>>;
  readonly biggestHit?: Record<string, number>;
}

const pct = (value: number) => `${Math.round(value * 100)}%`;
const esc = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A win-rate cell, tinted from red (hard) through to green (easy). */
const rateCell = (rate: number) => {
  const hue = Math.round(rate * 120);
  return `<td class="rate" style="--h:${hue}">${pct(rate)}</td>`;
};

function table(head: readonly string[], rows: readonly string[][]): string {
  return `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.join('')}</tr>`)
    .join('')}</tbody></table>`;
}

const td = (text: string | number) => `<td>${esc(String(text))}</td>`;

export function renderHtml(report: Report): string {
  const sections: string[] = [];

  if (report.sides) {
    const { mirrors, random } = report.sides;
    sections.push(`<section><h2>Fairness and pacing</h2>
<p>Class troops on both sides, the AI playing both. A fair game wins about half its mirror matches.</p>
${table(
  ['Battles', 'Player wins', 'Timed out', 'Never ended', 'Avg rounds', 'First mover wins'],
  [
    [
      td(`Mirror matches (${mirrors.battles})`),
      rateCell(mirrors.winRate),
      td(mirrors.timedOut),
      td(mirrors.stalls),
      td('–'),
      td('–'),
    ],
    [
      td(`Random 4v4 (${random.battles})`),
      rateCell(random.winRate),
      td(random.timedOut),
      td(random.stalls),
      td(random.avgRounds.toFixed(1)),
      td(pct(random.firstMoverWins)),
    ],
  ],
)}</section>`);
  }

  if (report.classes) {
    const dmg = report.damagePerUnit ?? {};
    sections.push(`<section><h2>Classes</h2>
<p>How often a squad that fielded the class won (random class troops), and the damage each unit of the class dealt per battle across every scenario.</p>
${table(
  ['Class', 'Squads with it win', 'Damage per unit (yours)', 'Damage per unit (enemy)'],
  Object.entries(report.classes).map(([cls, { winRate, battles }]) => [
    td(`${cls} (${battles})`),
    rateCell(winRate),
    td(dmg[`player:${cls}`] ?? '–'),
    td(dmg[`enemy:${cls}`] ?? '–'),
  ]),
)}</section>`);
  }

  if (report.skills) {
    sections.push(`<section><h2>Skills</h2>
${table(
  ['Skill', 'Uses', 'Damage per use', 'Kills'],
  Object.entries(report.skills).map(([id, s]) => [td(id), td(s.uses), td(s.perUse), td(s.kills)]),
)}</section>`);
  }

  if (report.contracts?.length) {
    const profiles = [...new Set(report.contracts.map((c) => c.profile))];
    const gears = [...new Set(report.contracts.map((c) => c.gear))];
    const blocks = gears.map((gear) => {
      const rows = [...new Set(report.contracts!.map((c) => `${c.level}|${c.tier}`))].map((key) => {
        const [level, tier] = key.split('|');
        const cells = profiles.map((profile) => {
          const c = report.contracts!.find(
            (x) => `${x.level}|${x.tier}` === key && x.profile === profile && x.gear === gear,
          );
          return c ? rateCell(c.winRate) : td('–');
        });
        const any = report.contracts!.filter(
          (x) => `${x.level}|${x.tier}` === key && x.gear === gear,
        );
        const rounds = any.reduce((s, x) => s + x.avgRounds, 0) / Math.max(1, any.length);
        const timed = any.reduce((s, x) => s + x.timedOut, 0);
        return [td(`Lv ${level}`), td(tier), ...cells, td(rounds.toFixed(1)), td(timed)];
      });
      return `<h3>${gear === 'none' ? 'No equipment' : 'Armoury weapon and armour'}</h3>${table(
        [
          'Squad',
          'Tier',
          ...profiles.map((p) => PROFILES[p as keyof typeof PROFILES].label),
          'Avg rounds',
          'Timed out',
        ],
        rows,
      )}`;
    });
    sections.push(`<section><h2>Guild contracts</h2>
<p>Player win rate by squad level and contract tier, for each kind of player. Squads are a frontliner and three random classes at the given level; the band is generated as on the guild board.</p>
${blocks.join('')}</section>`);
  }

  if (report.campaign?.length) {
    const profiles = [...new Set(report.campaign.map((c) => c.profile))];
    const gears = [...new Set(report.campaign.map((c) => c.gear))];
    const missions = [...new Set(report.campaign.map((c) => c.mission))];
    const rows = missions.flatMap((mission) =>
      gears.map((gear) => {
        const any = report.campaign!.filter((c) => c.mission === mission && c.gear === gear);
        return [
          td(`${any[0].title} (Lv ${any[0].level})`),
          td(gear === 'none' ? 'none' : 'armoury'),
          ...profiles.map((profile) => {
            const c = any.find((x) => x.profile === profile);
            return c ? rateCell(c.winRate) : td('–');
          }),
          td((any.reduce((s, x) => s + x.avgRounds, 0) / any.length).toFixed(1)),
        ];
      }),
    );
    sections.push(`<section><h2>Story missions</h2>
<p>Each mission fought by a random squad at the mission's level.</p>
${table(['Mission', 'Gear', ...profiles.map((p) => PROFILES[p as keyof typeof PROFILES].label), 'Avg rounds'], rows)}</section>`);
  }

  if (report.achievements) {
    const profiles = Object.keys(report.achievements);
    sections.push(`<section><h2>Achievement candidates</h2>
<p>Share of battles (contracts and story missions) in which each would unlock. Very common ones teach; rare ones (under ~2%) suit long-term goals.</p>
${table(
  ['Achievement', 'Rule', ...profiles.map((p) => PROFILES[p as keyof typeof PROFILES].label)],
  ACHIEVEMENTS.map((a) => [
    td(a.name),
    td(a.rule),
    ...profiles.map((p) => td(`${(report.achievements![p][a.id] * 100).toFixed(1)}%`)),
  ]),
)}
${
  report.biggestHit
    ? `<p>Biggest single blow per battle: ${Object.entries(report.biggestHit)
        .map(([k, v]) => `${k} ${v}`)
        .join(' · ')}</p>`
    : ''
}
</section>`);
  }

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lanes simulations</title>
<style>
:root { color-scheme: light dark; --bg: #f7f5f0; --fg: #1d1d1b; --muted: #6b675e; --line: #ddd8cc; }
@media (prefers-color-scheme: dark) { :root { --bg: #15171b; --fg: #ebe7de; --muted: #9a958a; --line: #2e3138; } }
body { margin: 0; padding: 24px 16px 48px; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; }
main { max-width: 980px; margin: 0 auto; }
h1 { margin: 0 0 4px; font-size: 1.6rem; } h2 { margin-top: 36px; } h3 { margin: 20px 0 6px; font-size: 1rem; }
p { color: var(--muted); max-width: 70ch; }
table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; display: block; overflow-x: auto; }
th, td { padding: 5px 10px; border-bottom: 1px solid var(--line); text-align: left; white-space: nowrap; }
th { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
td.rate { background: hsl(var(--h) 55% 50% / 0.22); font-weight: 600; }
</style></head><body><main>
<h1>Lanes battle simulations</h1>
<p>${report.battles} battles in ${(report.ms / 1000).toFixed(1)} s · seed ${report.seed} · ${report.size} battles per cell · ${esc(report.generated)}. The AI plays both sides; the profiles stand in for a player's timing on the execution bar (assumed odds, see sim/profiles.ts).</p>
${sections.join('\n')}
</main></body></html>`;
}
