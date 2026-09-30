import { describe, expect, it } from 'vitest';
import {
  GRADES,
  PRIMARY_STATS,
  PrimaryStat,
  deriveCombatStats,
  generateMercenary,
  generateStarterRoster,
  parseMercenary,
  seededRandom,
} from './mercenary.model';
import { ALL_CLASSES, FIGHTER_CLASS, WITCH_CLASS } from './unit-class.model';

describe('mercenary generation', () => {
  it('is deterministic for a seed and varies between seeds', () => {
    const a = generateMercenary('fighter', seededRandom(1));
    expect(generateMercenary('fighter', seededRandom(1))).toEqual(a);
    expect(generateMercenary('fighter', seededRandom(2))).not.toEqual(a);
  });

  it('gives every primary stat a grade and a value matching its grade', () => {
    for (let seed = 0; seed < 50; seed++) {
      const merc = generateMercenary('archer', seededRandom(seed));
      for (const stat of PRIMARY_STATS) {
        const gradeIndex = GRADES.indexOf(merc.aptitudes[stat]);
        expect(gradeIndex).toBeGreaterThanOrEqual(0);
        const min = 8 + gradeIndex * 3;
        expect(merc.stats[stat]).toBeGreaterThanOrEqual(min);
        expect(merc.stats[stat]).toBeLessThanOrEqual(min + 4);
      }
      expect(merc.stats.sp).toBeGreaterThan(0);
    }
  });

  it('rolls better aptitudes on a class focus stat than off it', () => {
    const mean = (classId: string, stat: PrimaryStat) => {
      let total = 0;
      for (let seed = 0; seed < 300; seed++) {
        total += GRADES.indexOf(generateMercenary(classId, seededRandom(seed)).aptitudes[stat]);
      }
      return total / 300;
    };
    expect(mean('fighter', 'str')).toBeGreaterThan(mean('fighter', 'mag'));
    expect(mean('witch', 'mag')).toBeGreaterThan(mean('witch', 'str'));
  });

  it('creates a starter roster with one unique mercenary per class', () => {
    const roster = generateStarterRoster(seededRandom(7));
    expect(roster.map((m) => m.classId)).toEqual(ALL_CLASSES.map((c) => c.id));
    expect(new Set(roster.map((m) => m.id)).size).toBe(roster.length);
  });
});

describe('deriveCombatStats', () => {
  const neutral = () => {
    const merc = generateMercenary('fighter', seededRandom(3));
    for (const stat of PRIMARY_STATS) merc.stats[stat] = 17;
    return merc;
  };

  it('leaves class values unchanged for neutral stats', () => {
    expect(deriveCombatStats(FIGHTER_CLASS, neutral())).toEqual(FIGHTER_CLASS.baseStats);
  });

  it('maps each attribute onto its combat stat', () => {
    const merc = neutral();
    const base = deriveCombatStats(WITCH_CLASS, merc);
    const raised = (stat: PrimaryStat) =>
      deriveCombatStats(WITCH_CLASS, { ...merc, stats: { ...merc.stats, [stat]: 27 } });
    expect(raised('str').attack).toBeGreaterThan(base.attack);
    expect(raised('mag').magicAttack).toBeGreaterThan(base.magicAttack);
    expect(raised('tec').technique).toBeGreaterThan(base.technique);
    expect(raised('vit').vitality).toBeGreaterThan(base.vitality);
    expect(raised('stm').defense).toBeGreaterThan(base.defense);
    expect(raised('spi').magicDefense).toBeGreaterThan(base.magicDefense);
    expect(raised('con').maxHp).toBeGreaterThan(base.maxHp);
    expect(raised('agi').speed).toBeGreaterThan(base.speed);
    expect(raised('agi').agility).toBeGreaterThan(base.agility);
  });

  it('does not give a class a damage type it lacks', () => {
    const merc = neutral();
    merc.stats.mag = 26;
    expect(deriveCombatStats(FIGHTER_CLASS, merc).magicAttack).toBe(0);
  });
});

describe('parseMercenary', () => {
  const merc = generateMercenary('cleric', seededRandom(9));

  it('round-trips a generated mercenary', () => {
    expect(parseMercenary(JSON.parse(JSON.stringify(merc)))).toEqual(merc);
  });

  it('rejects malformed data', () => {
    expect(parseMercenary(null)).toBeNull();
    expect(parseMercenary({ ...merc, classId: 'paladin' })).toBeNull();
    expect(parseMercenary({ ...merc, level: 0 })).toBeNull();
    expect(parseMercenary({ ...merc, aptitudes: { ...merc.aptitudes, str: 'Z' } })).toBeNull();
    expect(parseMercenary({ ...merc, stats: { ...merc.stats, str: -5 } })).toBeNull();
    expect(parseMercenary({ ...merc, stats: { ...merc.stats, sp: 1.5 } })).toBeNull();
  });
});
