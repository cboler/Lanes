import { describe, expect, it } from 'vitest';
import { createDefaultDefensePlan, parseDefensePlan } from './defense-plan.model';
import { generateMercenary, generateStarterRoster, seededRandom } from './mercenary.model';
import { getClassDefinition } from './unit-class.model';

const roster = generateStarterRoster(seededRandom(7));

describe('defense plan validation', () => {
  it('starts with four roster mercenaries in the default lineup, each with separate turn slots', () => {
    const plan = createDefaultDefensePlan(roster);
    expect(plan.members.map((m) => m.mercenary.classId)).toEqual([
      'lancer',
      'gunner',
      'witch',
      'fighter',
    ]);
    expect(plan.members.every((m) => roster.some((r) => r.id === m.mercenary.id))).toBe(true);
    expect(plan.members.every((member) => member.orders.length === 4)).toBe(true);
    plan.members[0].orders[0].abilityId = 'guard';
    expect(plan.members[0].orders[1].abilityId).toBe('auto');
    // The plan holds copies: editing it never touches the roster.
    plan.members[0].mercenary.name = 'Changed';
    expect(roster.some((merc) => merc.name === 'Changed')).toBe(false);
  });

  it('fills a small roster with whoever is available', () => {
    const plan = createDefaultDefensePlan([roster[1], roster[2]]);
    expect(plan.members.map((m) => m.mercenary.id)).toEqual([roster[1].id, roster[2].id]);
  });

  it('rejects stale or tampered saved orders before they reach combat', () => {
    const original = createDefaultDefensePlan(roster);
    expect(parseDefensePlan({ ...original, version: 3 })).toBeNull();
    expect(parseDefensePlan({ ...original, members: [] })).toBeNull();
    // The same mercenary cannot defend twice.
    expect(
      parseDefensePlan({ ...original, members: [original.members[0], original.members[0]] }),
    ).toBeNull();
    const badSheet = structuredClone(original);
    badSheet.members[0].mercenary.stats.str = -5;
    expect(parseDefensePlan(badSheet)).toBeNull();
    const shortOrders = structuredClone(original);
    shortOrders.members[0].orders = shortOrders.members[0].orders.slice(0, 1);
    expect(parseDefensePlan(shortOrders)).toBeNull();
    const wrongClass = structuredClone(original);
    wrongClass.members[0].orders[0].abilityId = 'meteor';
    expect(parseDefensePlan(wrongClass)).toBeNull();
    const wrongPriority = structuredClone(original);
    wrongPriority.members[0].orders[0].targetPriority = 'random' as never;
    expect(parseDefensePlan(wrongPriority)).toBeNull();
  });

  it('turns an order for a skill the defender no longer knows into auto', () => {
    const plan = createDefaultDefensePlan(roster);
    const member = plan.members[0];
    const [skill] = getClassDefinition(member.mercenary.classId).advancedAbilities.filter(
      (ability) => !member.mercenary.pattern.some((step) => step.id === ability.id),
    );
    member.orders[0].abilityId = skill.id;
    expect(parseDefensePlan(plan)!.members[0].orders[0].abilityId).toBe('auto');
  });

  it('returns an independent sanitized copy', () => {
    const plan = Object.assign(createDefaultDefensePlan(roster), { privileged: true });
    const parsed = parseDefensePlan(plan)!;
    expect(parsed).not.toBe(plan);
    expect(Object.keys(parsed)).toEqual(['version', 'members']);
    plan.members[0].orders[0].abilityId = 'guard';
    expect(parsed.members[0].orders[0].abilityId).toBe('auto');
  });

  it("refreshes a defender's sheet from the roster, and keeps the snapshot otherwise", () => {
    const plan = createDefaultDefensePlan(roster);
    const grown = roster.map((merc) => ({ ...merc, level: merc.level + 1 }));
    expect(parseDefensePlan(plan, grown)!.members[0].mercenary.level).toBe(2);
    expect(parseDefensePlan(plan, [])!.members[0].mercenary.level).toBe(1);
  });

  it('upgrades a class-only version 1 plan with unused roster mercenaries of each class', () => {
    const orders = Array.from({ length: 4 }, () => ({
      abilityId: 'thrust',
      targetPriority: 'closest',
    }));
    const v1 = {
      version: 1,
      members: [
        { classId: 'lancer', orders },
        { classId: 'fighter', orders: createDefaultDefensePlan(roster).members[0].orders },
      ],
    };
    const lancer = roster.find((m) => m.classId === 'lancer')!;
    const fighter = roster.find((m) => m.classId === 'fighter')!;
    const upgraded = parseDefensePlan(v1, roster)!;
    expect(upgraded.version).toBe(2);
    expect(upgraded.members.map((m) => m.mercenary.id)).toEqual([lancer.id, fighter.id]);
    expect(upgraded.members[0].orders[0].abilityId).toBe('thrust');

    // Two lancers need two lancer mercenaries.
    const twoLancers = { version: 1, members: [v1.members[0], v1.members[0]] };
    expect(parseDefensePlan(twoLancers, roster)).toBeNull();
    const extra = generateMercenary('lancer', seededRandom(99));
    expect(parseDefensePlan(twoLancers, [...roster, extra])?.members).toHaveLength(2);
  });

  it('keeps orders only for skills the defender has learned; others become auto', () => {
    const plan = createDefaultDefensePlan(roster);
    const member = plan.members[0];
    const step = member.mercenary.pattern[1];
    member.orders[0].abilityId = step.id;
    expect(parseDefensePlan(plan)?.members[0].orders[0].abilityId).toBe('auto');
    member.mercenary.level = step.level;
    expect(parseDefensePlan(plan)?.members[0].orders[0].abilityId).toBe(step.id);
  });
});
