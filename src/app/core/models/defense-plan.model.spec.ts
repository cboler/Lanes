import { describe, expect, it } from 'vitest';
import { createDefaultDefensePlan, parseDefensePlan } from './defense-plan.model';

describe('defense plan validation', () => {
  it('starts with four legal defenders and four separate turn slots', () => {
    const plan = createDefaultDefensePlan();
    expect(plan.members).toHaveLength(4);
    expect(plan.members.every((member) => member.orders.length === 4)).toBe(true);
    plan.members[0].orders[0].abilityId = 'guard';
    expect(plan.members[0].orders[1].abilityId).toBe('auto');
  });

  it('rejects stale or tampered saved orders before they reach combat', () => {
    const original = createDefaultDefensePlan();
    expect(parseDefensePlan({ ...original, version: 2 })).toBeNull();
    expect(parseDefensePlan({ ...original, members: [] })).toBeNull();
    expect(
      parseDefensePlan({ ...original, members: [original.members[0], ...original.members] }),
    ).toBeNull();
    expect(
      parseDefensePlan({
        ...original,
        members: [{ classId: 'unknown', orders: original.members[0].orders }],
      }),
    ).toBeNull();
    expect(
      parseDefensePlan({
        ...original,
        members: [
          { classId: 'lancer', orders: [{ abilityId: 'auto', targetPriority: 'closest' }] },
        ],
      }),
    ).toBeNull();
    const wrongClass = structuredClone(original);
    wrongClass.members[0].orders[0].abilityId = 'meteor';
    expect(parseDefensePlan(wrongClass)).toBeNull();
    const wrongPriority = structuredClone(original);
    wrongPriority.members[0].orders[0].targetPriority = 'random' as never;
    expect(parseDefensePlan(wrongPriority)).toBeNull();
  });

  it('returns an independent sanitized copy', () => {
    const plan = Object.assign(createDefaultDefensePlan(), { privileged: true });
    const parsed = parseDefensePlan(plan)!;
    expect(parsed).not.toBe(plan);
    expect(Object.keys(parsed)).toEqual(['version', 'members']);
    plan.members[0].orders[0].abilityId = 'guard';
    expect(parsed.members[0].orders[0].abilityId).toBe('auto');
  });
});
