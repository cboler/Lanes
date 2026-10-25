import { describe, expect, it } from 'vitest';
import { generateMercenary, seededRandom } from './mercenary.model';
import {
  BattleReport,
  LEVEL_CAP,
  POINTS_PER_LEVEL,
  RECRUIT_COUNT,
  battleExp,
  battleGold,
  dropChance,
  expToNext,
  gainExp,
  generateRecruits,
  hireCost,
  investPoint,
} from './progression.model';

const merc = () => generateMercenary('fighter', seededRandom(4));
const report = (outcome: 'victory' | 'defeat', enemiesDefeated: number): BattleReport => ({
  id: 'r',
  outcome,
  enemiesDefeated,
  mercenaries: [],
});

describe('progression', () => {
  it('pays more gold and EXP for victories and for each enemy defeated', () => {
    expect(battleGold(report('victory', 4))).toBeGreaterThan(battleGold(report('defeat', 4)));
    expect(battleGold(report('defeat', 2))).toBeGreaterThan(battleGold(report('defeat', 0)));
    const unit = { ...merc(), stats: { ...merc().stats, tec: 17 } };
    expect(battleExp(report('victory', 4), unit, true)).toBe(110);
    expect(battleExp(report('victory', 4), unit, false)).toBe(55);
  });

  it('lets TEC raise EXP, as in the spec', () => {
    const base = merc();
    const sharp = { ...base, stats: { ...base.stats, tec: 27 } };
    const dull = { ...base, stats: { ...base.stats, tec: 9 } };
    expect(battleExp(report('victory', 2), sharp, true)).toBeGreaterThan(
      battleExp(report('victory', 2), dull, true),
    );
  });

  it('levels up as often as the EXP pays for, granting points and SP, and stops at the cap', () => {
    const start = merc();
    const once = gainExp(start, expToNext(1) + 5);
    expect(once.level).toBe(2);
    expect(once.exp).toBe(5);
    expect(once.statPoints).toBe(POINTS_PER_LEVEL);
    expect(once.stats.sp).toBe(start.stats.sp + 1);
    expect(start.level).toBe(1);
    const twice = gainExp(start, expToNext(1) + expToNext(2));
    expect(twice.level).toBe(3);
    expect(gainExp(start, 10_000_000).level).toBe(LEVEL_CAP);
  });

  it('turns invested points into bonus points at the aptitude ratio', () => {
    let s = { ...merc(), statPoints: 4 };
    s.aptitudes = { ...s.aptitudes, str: 'S' };
    const before = s.stats.str;
    s = investPoint(s, 'str')!;
    expect(s.stats.str).toBe(before + 1);
    s = investPoint(s, 'str')!;
    // An S stat earns a bonus point every 2 invested.
    expect(s.stats.str).toBe(before + 3);
    expect(s.statPoints).toBe(2);
    let f = { ...merc(), statPoints: 8 };
    f.aptitudes = { ...f.aptitudes, mag: 'F' };
    const mag = f.stats.mag;
    for (let i = 0; i < 8; i++) f = investPoint(f, 'mag')!;
    expect(f.stats.mag).toBe(mag + 9);
    expect(investPoint(f, 'mag')).toBeNull();
  });

  it('prices better aptitudes higher and fills a board with differently named recruits', () => {
    const plain = merc();
    const gifted = { ...plain, aptitudes: { ...plain.aptitudes, str: 'S' as const } };
    if (plain.aptitudes.str !== 'S') expect(hireCost(gifted)).toBeGreaterThan(hireCost(plain));
    const recruits = generateRecruits(seededRandom(3), ['Aldric']);
    expect(recruits).toHaveLength(RECRUIT_COUNT);
    expect(new Set(recruits.map((r) => r.name)).size).toBe(RECRUIT_COUNT);
    expect(recruits.some((r) => r.name === 'Aldric')).toBe(false);
  });
});

describe('auto-invest', () => {
  it('spends every waiting point on the class focus, round-robin', async () => {
    const { autoInvest, gainExp } = await import('./progression.model');
    const { generateMercenary, seededRandom, CLASS_FOCUS } = await import('./mercenary.model');
    const merc = gainExp(generateMercenary('archer', seededRandom(9)), 400);
    expect(merc.statPoints).toBeGreaterThan(0);
    const spent = autoInvest(merc);
    expect(spent.statPoints).toBe(0);
    const focus = CLASS_FOCUS['archer'];
    const total = focus.reduce((sum, stat) => sum + spent.invested[stat], 0);
    expect(total).toBe(merc.statPoints);
    // Spread evenly: no focus stat is more than one point ahead of another.
    const counts = focus.map((stat) => spent.invested[stat]);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });
});

describe('dropChance', () => {
  const won = { id: 'r', outcome: 'victory' as const, enemiesDefeated: 4, mercenaries: [] };
  it('gives contract, map and story wins a chance at equipment, rising with foes felled', () => {
    expect(dropChance(won)).toBe(0);
    expect(dropChance({ ...won, outcome: 'defeat', contractId: 'c' })).toBe(0);
    expect(dropChance({ ...won, contractId: 'c' })).toBeCloseTo(0.4);
    expect(dropChance({ ...won, missionId: 'm', enemiesDefeated: 20 })).toBe(0.6);
  });
});
