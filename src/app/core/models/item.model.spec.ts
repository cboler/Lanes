import { describe, expect, it } from 'vitest';
import {
  addItems,
  applyCharm,
  applyGrimoire,
  applyTactics,
  canScribe,
  grimoireSkill,
  itemName,
  parseInventory,
} from './item.model';
import { Mercenary, generateMercenary, seededRandom } from './mercenary.model';
import { investPoint } from './progression.model';
import { getClassDefinition } from './unit-class.model';

function archer(): Mercenary {
  const merc = generateMercenary('archer', seededRandom(3));
  merc.aptitudes.str = 'C';
  merc.stats.str = 17;
  merc.statPoints = 20;
  return merc;
}

function investTimes(merc: Mercenary, times: number): Mercenary {
  for (let i = 0; i < times; i++) merc = investPoint(merc, 'str')!;
  return merc;
}

describe('items', () => {
  it('a Tactics Scroll raises an aptitude and back-pays the better rate', () => {
    // C pays a bonus every 5 points: 10 invested gives 10 + 2.
    const invested = investTimes(archer(), 10);
    expect(invested.stats.str).toBe(17 + 12);
    const raised = applyTactics(invested, 'str')!;
    // B pays every 4: 10 invested is now worth 10 + 2 as well, so nothing changes yet...
    expect(raised.aptitudes.str).toBe('B');
    expect(raised.stats.str).toBe(29);
    // ...but A (every 3) is worth 10 + 3.
    const twice = applyTactics(raised, 'str')!;
    expect(twice.aptitudes.str).toBe('A');
    expect(twice.stats.str).toBe(30);
    twice.aptitudes.str = 'S';
    expect(applyTactics(twice, 'str')).toBeNull();
  });

  it('a Charm Scroll refunds every invested point and the bonus it earned', () => {
    const before = archer();
    const after = applyCharm(applyTactics(investTimes(before, 12), 'str')!)!;
    expect(after.stats.str).toBe(before.stats.str);
    expect(after.statPoints).toBe(before.statPoints);
    expect(after.invested.str).toBe(0);
    expect(applyCharm(before)).toBeNull();
  });

  it('a grimoire is scribed from a learned skill and taught in place of a pattern skill', () => {
    const merc = archer();
    const [first, second] = merc.pattern;
    expect(canScribe(merc, first.id)).toBe(false);
    merc.level = first.level;
    expect(canScribe(merc, first.id)).toBe(true);
    const pool = getClassDefinition('archer').advancedAbilities.map((a) => a.id);
    const missing = pool.find((id) => !merc.pattern.some((step) => step.id === id))!;
    const taught = applyGrimoire(merc, `grimoire:${missing}`, second.id)!;
    expect(taught.pattern).toEqual([first, { id: missing, level: second.level }]);
    // Not for another class, nor a skill already in the pattern.
    const witchSkill = getClassDefinition('witch').advancedAbilities[0].id;
    expect(applyGrimoire(merc, `grimoire:${witchSkill}`, second.id)).toBeNull();
    expect(applyGrimoire(merc, `grimoire:${first.id}`, second.id)).toBeNull();
    expect(grimoireSkill(`grimoire:${missing}`)?.classId).toBe('archer');
    expect(itemName(`grimoire:${missing}`)).toMatch(/^Grimoire: /);
  });

  it('keeps only known items with sensible counts', () => {
    const skill = getClassDefinition('witch').advancedAbilities[0].id;
    expect(
      parseInventory({ tactics: 2, charm: -1, gem: 4, [`grimoire:${skill}`]: 1, 'grimoire:x': 1 }),
    ).toEqual({ tactics: 2, [`grimoire:${skill}`]: 1 });
    expect(parseInventory('nope')).toEqual({});
    expect(addItems({ tactics: 1 }, ['tactics', 'charm'])).toEqual({ tactics: 2, charm: 1 });
    expect(addItems({ tactics: 1 }, ['tactics'], -1)).toEqual({});
  });
});
