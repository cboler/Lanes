import { describe, expect, it } from 'vitest';
import { generateMercenary, parseMercenary, seededRandom } from './mercenary.model';
import {
  PATTERN_LENGTH,
  applySupports,
  canEquipSupport,
  knownAbilities,
  parsePattern,
  rollPattern,
} from './skills.model';
import { ALL_CLASSES, FIGHTER_CLASS } from './unit-class.model';

describe('skill patterns', () => {
  it('teaches some of the class advanced skills, once each, the first earlier than the second', () => {
    for (const cls of ALL_CLASSES) {
      for (let seed = 0; seed < 20; seed++) {
        const pattern = rollPattern(cls.id, seededRandom(seed));
        expect(pattern).toHaveLength(PATTERN_LENGTH);
        expect(new Set(pattern.map((step) => step.id)).size).toBe(PATTERN_LENGTH);
        for (const step of pattern) {
          expect(cls.advancedAbilities.some((skill) => skill.id === step.id)).toBe(true);
        }
        expect(pattern[0].level).toBeLessThan(pattern[1].level);
      }
    }
  });

  it('varies between mercenaries, so hunting for a pattern means something', () => {
    const patterns = new Set(
      Array.from({ length: 30 }, (_, seed) =>
        JSON.stringify(rollPattern('archer', seededRandom(seed))),
      ),
    );
    expect(patterns.size).toBeGreaterThan(5);
  });

  it('knows core skills from level 1 and pattern skills once their level is reached', () => {
    const merc = generateMercenary('fighter', seededRandom(2));
    const [first, second] = merc.pattern;
    expect(knownAbilities(merc).map((a) => a.id)).toEqual(FIGHTER_CLASS.abilities.map((a) => a.id));
    const middle = knownAbilities({ ...merc, level: first.level }).map((a) => a.id);
    expect(middle).toContain(first.id);
    expect(middle).not.toContain(second.id);
    expect(knownAbilities({ ...merc, level: 99 })).toHaveLength(3 + PATTERN_LENGTH);
  });

  it('rejects patterns naming another class skill or repeating one', () => {
    expect(parsePattern('fighter', [{ id: 'meteor', level: 3 }])).toBeNull();
    expect(
      parsePattern('fighter', [
        { id: 'rally', level: 3 },
        { id: 'rally', level: 6 },
      ]),
    ).toBeNull();
    expect(parsePattern('fighter', [{ id: 'rally', level: 3 }])).toEqual([
      { id: 'rally', level: 3 },
    ]);
  });

  it('gives a mercenary saved before patterns a stable one', () => {
    const merc = generateMercenary('witch', seededRandom(8));
    const legacy: Record<string, unknown> = { ...merc };
    delete legacy['pattern'];
    delete legacy['supports'];
    const first = parseMercenary(legacy)!;
    expect(first.pattern).toHaveLength(PATTERN_LENGTH);
    expect(parseMercenary(legacy)!.pattern).toEqual(first.pattern);
    expect(first.supports).toEqual([]);
  });
});

describe('support skills', () => {
  it('equips only what the level unlocks and the SP pays for', () => {
    const merc = { ...generateMercenary('fighter', seededRandom(1)), level: 1 };
    merc.stats.sp = 10;
    expect(canEquipSupport(merc, 'vigor')).toBe(true);
    expect(canEquipSupport(merc, 'might')).toBe(false);
    expect(canEquipSupport({ ...merc, supports: ['vigor', 'iron_skin'] }, 'vigor')).toBe(false);
    // 4 + 4 + 5 SP is more than 10.
    expect(
      canEquipSupport({ ...merc, level: 3, supports: ['vigor', 'iron_skin'] }, 'fleet_foot'),
    ).toBe(false);
    expect(canEquipSupport(merc, 'unknown')).toBe(false);
  });

  it('raises derived stats, and drops supports a saved sheet cannot afford', () => {
    const boosted = applySupports(FIGHTER_CLASS.baseStats, ['vigor', 'iron_skin']);
    expect(boosted.maxHp).toBe(275);
    expect(boosted.defense).toBe(55);
    // A stat the class does not use stays at zero.
    expect(applySupports(FIGHTER_CLASS.baseStats, ['might']).magicAttack).toBe(0);

    const merc = generateMercenary('fighter', seededRandom(1));
    const saved = { ...merc, supports: ['vigor', 'iron_skin', 'might', 'vigor'] };
    expect(parseMercenary(saved)!.supports).toEqual(['vigor', 'iron_skin']);
  });
});
