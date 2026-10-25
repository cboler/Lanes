import { describe, expect, it } from 'vitest';
import {
  applyBondGains,
  bondGains,
  bondKey,
  bondPower,
  bondRank,
  nextBondRank,
  parseBonds,
} from './bond.model';
import { BattleReport } from './progression.model';
import { ARCHER_CLASS, FIGHTER_CLASS } from './unit-class.model';
import { UnitInstance } from './unit-instance.model';

const report = (patch: Partial<BattleReport> = {}): BattleReport => ({
  id: 'r',
  outcome: 'victory',
  enemiesDefeated: 4,
  mercenaries: [
    { id: 'a', survived: true },
    { id: 'b', survived: true },
    { id: 'c', survived: false },
  ],
  ...patch,
});

describe('squad bonds', () => {
  it('grow for every pair who fought, more for a win, survival, assists and tended wounds', () => {
    const gains = bondGains(
      report({
        assists: [['a', 'b']],
        heals: [
          ['c', 'a'],
          ['c', 'a'],
          ['c', 'a'],
          ['c', 'a'],
        ],
      }),
    );
    expect(gains[bondKey('a', 'b')]).toBe(6 + 2 + 4);
    // Three heals count; the fourth does not.
    expect(gains[bondKey('a', 'c')]).toBe(6 + 6);
    expect(gains[bondKey('b', 'c')]).toBe(6);
    expect(bondGains(report({ outcome: 'defeat' }))[bondKey('a', 'b')]).toBe(3 + 2);
  });

  it('rank up at 20, 60 and 120 points and report each new rank once', () => {
    expect([0, 19, 20, 59, 60, 120].map(bondRank)).toEqual([0, 0, 1, 1, 2, 3]);
    expect(nextBondRank(25)?.title).toBe('Trusted');
    expect(nextBondRank(500)).toBeNull();
    const key = bondKey('a', 'b');
    const first = applyBondGains({ [key]: 15 }, { [key]: 10 });
    expect(first.bonds[key]).toBe(25);
    expect(first.rankUps).toEqual([
      { ids: ['a', 'b'], rank: expect.objectContaining({ rank: 1 }) },
    ]);
    expect(applyBondGains(first.bonds, { [key]: 5 }).rankUps).toEqual([]);
  });

  it('keep only valid pairs of current roster members when loaded', () => {
    expect(
      parseBonds({ 'a|b': 30, 'a|z': 9, 'b|b': 4, 'a|b|c': 1, 'b|c': -2, 'c|a': 1.5 }, [
        'a',
        'b',
        'c',
      ]),
    ).toEqual({ 'a|b': 30 });
  });

  it('give Comrades +10% damage per partner sharing the lane, two at most', () => {
    const unit = new UnitInstance(FIGHTER_CLASS, 'A', 'player', 1, 0.3);
    const near = new UnitInstance(ARCHER_CLASS, 'B', 'player', 1, 0.1);
    const far = new UnitInstance(ARCHER_CLASS, 'C', 'player', 2, 0.1);
    unit.bonds = [
      { partner: near, rank: 1 },
      { partner: far, rank: 3 },
    ];
    expect(bondPower(unit)).toBeCloseTo(1.1);
    far.lane = 1;
    expect(bondPower(unit)).toBeCloseTo(1.2);
    near.takeDamage(99999);
    expect(bondPower(unit)).toBeCloseTo(1.1);
  });
});
