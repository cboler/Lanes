import { describe, expect, it } from 'vitest';
import {
  expMultiplier,
  marchRecovery,
  parseFacilities,
  reforgeMultiplier,
  restMultiplier,
  rosterLimit,
  upgradeCost,
} from './facility.model';

describe('guild facilities', () => {
  it('cost more each level and stop at three', () => {
    expect(upgradeCost({}, 'barracks')).toBe(400);
    expect(upgradeCost({ barracks: 2 }, 'barracks')).toBe(1600);
    expect(upgradeCost({ barracks: 3 }, 'barracks')).toBeNull();
  });

  it('grow the roster, EXP, recovery and discounts by level', () => {
    expect(rosterLimit({})).toBe(12);
    expect(rosterLimit({ barracks: 3 })).toBe(18);
    expect(expMultiplier({ training: 2 })).toBeCloseTo(1.2);
    expect(reforgeMultiplier({ smithy: 3 })).toBeCloseTo(0.7);
    expect(marchRecovery({ infirmary: 1 })).toBeCloseTo(0.08);
    expect(restMultiplier({ infirmary: 2 })).toBeCloseTo(0.5);
  });

  it('keep only known facilities at sensible levels when loaded', () => {
    expect(parseFacilities({ barracks: 2, smithy: 9, kitchen: 1, training: -1 })).toEqual({
      barracks: 2,
      smithy: 3,
    });
  });
});
