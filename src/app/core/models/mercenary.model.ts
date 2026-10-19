import { UnitBaseStats } from './stats.model';
import { ALL_CLASSES, UnitClassDefinition, getClassDefinition } from './unit-class.model';

export const PRIMARY_STATS = ['str', 'mag', 'tec', 'vit', 'stm', 'spi', 'agi', 'con'] as const;
export type PrimaryStat = (typeof PRIMARY_STATS)[number];

export const STAT_LABELS: Record<PrimaryStat | 'sp', string> = {
  str: 'STR',
  mag: 'MAG',
  tec: 'TEC',
  vit: 'VIT',
  stm: 'STM',
  spi: 'SPI',
  agi: 'AGI',
  con: 'CON',
  sp: 'SP',
};

export const GRADES = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;
export type Grade = (typeof GRADES)[number];

/** Level 1 baseline for each aptitude grade; a roll of 0-4 is added on top. */
const GRADE_BASE: Record<Grade, number> = { F: 8, E: 11, D: 14, C: 17, B: 20, A: 23, S: 26 };
/** A stat at this value leaves the class's tuned combat number unchanged. */
const NEUTRAL_STAT = 17;
const STAT_SCALE = 0.02;
const STARTING_SP = 10;

export type Aptitudes = Record<PrimaryStat, Grade>;
export type MercenaryStats = Record<PrimaryStat, number> & { sp: number };

export interface Mercenary {
  id: string;
  name: string;
  classId: string;
  level: number;
  /** EXP toward the next level. */
  exp: number;
  /** Points from level-ups, waiting to be invested in stats. */
  statPoints: number;
  /** Points invested in each stat so far; aptitude turns them into bonus points. */
  invested: Record<PrimaryStat, number>;
  aptitudes: Aptitudes;
  stats: MercenaryStats;
}

const noInvestment = (): Record<PrimaryStat, number> =>
  Object.fromEntries(PRIMARY_STATS.map((stat) => [stat, 0])) as Record<PrimaryStat, number>;

/** Returns a float in [0, 1). Injectable so generation and tests are deterministic. */
export type Random = () => number;

export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stats each class leans on; these roll their aptitude twice and keep the better result. */
const CLASS_FOCUS: Record<string, readonly PrimaryStat[]> = {
  fighter: ['str', 'vit', 'stm', 'con'],
  cleric: ['mag', 'spi', 'vit'],
  archer: ['tec', 'agi', 'str'],
  witch: ['mag', 'spi', 'agi'],
  lancer: ['str', 'agi', 'con'],
  gunner: ['tec', 'str', 'agi'],
};

// Weighted toward the middle; S is rare.
const GRADE_WEIGHTS: readonly number[] = [8, 14, 22, 26, 18, 9, 3];

function rollGrade(random: Random): Grade {
  const total = GRADE_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
  let pick = random() * total;
  for (let i = 0; i < GRADES.length; i++) {
    pick -= GRADE_WEIGHTS[i];
    if (pick < 0) return GRADES[i];
  }
  return GRADES[GRADES.length - 1];
}

const NAMES = [
  'Aldric',
  'Brenna',
  'Cassian',
  'Dara',
  'Edric',
  'Fiora',
  'Garrick',
  'Helena',
  'Ivo',
  'Jora',
  'Kael',
  'Lyra',
  'Marek',
  'Nessa',
  'Orin',
  'Petra',
  'Quill',
  'Rowan',
  'Sable',
  'Talia',
];

export function generateMercenary(
  classId: string,
  random: Random,
  takenNames: readonly string[] = [],
): Mercenary {
  const cls = getClassDefinition(classId);
  const focus = CLASS_FOCUS[cls.id] ?? [];
  const aptitudes = {} as Aptitudes;
  const stats = { sp: STARTING_SP } as MercenaryStats;
  for (const stat of PRIMARY_STATS) {
    let grade = rollGrade(random);
    if (focus.includes(stat)) {
      const second = rollGrade(random);
      if (GRADES.indexOf(second) > GRADES.indexOf(grade)) grade = second;
    }
    aptitudes[stat] = grade;
    stats[stat] = GRADE_BASE[grade] + Math.floor(random() * 5);
  }
  // Prefer a name nobody in `takenNames` has, so a roster rarely has two of the same.
  const free = NAMES.filter((n) => !takenNames.includes(n));
  const names = free.length ? free : NAMES;
  const name = names[Math.floor(random() * names.length)];
  const id = `merc_${Math.floor(random() * 0xffffffff).toString(36)}${Math.floor(random() * 0xffffff).toString(36)}`;
  return {
    id,
    name,
    classId: cls.id,
    level: 1,
    exp: 0,
    statPoints: 0,
    invested: noInvestment(),
    aptitudes,
    stats,
  };
}

export function generateStarterRoster(random: Random): Mercenary[] {
  const roster: Mercenary[] = [];
  for (const cls of ALL_CLASSES) {
    let merc = generateMercenary(
      cls.id,
      random,
      roster.map((m) => m.name),
    );
    while (roster.some((existing) => existing.id === merc.id)) {
      merc = generateMercenary(
        cls.id,
        random,
        roster.map((m) => m.name),
      );
    }
    roster.push(merc);
  }
  return roster;
}

function scaled(base: number, stat: number): number {
  return Math.max(1, Math.round(base * (1 + (stat - NEUTRAL_STAT) * STAT_SCALE)));
}

/**
 * Maps the character sheet onto the combat stats the engine already uses.
 * Each stat scales the class's tuned value, so class identity survives and a
 * stat the class does not use (for example MAG on a Fighter) has no effect.
 *
 *   STR -> attack        MAG -> magicAttack     TEC -> technique (Guard strength)
 *   VIT -> vitality (AP recovery)               STM -> defense
 *   SPI -> magicDefense  AGI -> speed and agility (MG recovery)
 *   CON -> maxHp         SP  -> spent on skills later; no combat effect yet
 */
export function deriveCombatStats(cls: UnitClassDefinition, merc: Mercenary): UnitBaseStats {
  const base = cls.baseStats;
  const { stats } = merc;
  return {
    maxHp: scaled(base.maxHp, stats.con),
    attack: base.attack === 0 ? 0 : scaled(base.attack, stats.str),
    defense: scaled(base.defense, stats.stm),
    speed: scaled(base.speed, stats.agi),
    agility: scaled(base.agility, stats.agi),
    vitality: scaled(base.vitality, stats.vit),
    technique: scaled(base.technique, stats.tec),
    magicAttack: base.magicAttack === 0 ? 0 : scaled(base.magicAttack, stats.mag),
    magicDefense: scaled(base.magicDefense, stats.spi),
    meleeRange: base.meleeRange,
  };
}

/** Validate untrusted (saved) input and return a sanitized copy, or null. */
export function parseMercenary(value: unknown): Mercenary | null {
  if (!value || typeof value !== 'object') return null;
  const merc = value as Partial<Mercenary>;
  if (
    typeof merc.id !== 'string' ||
    !merc.id ||
    typeof merc.name !== 'string' ||
    !merc.name ||
    merc.name.length > 24 ||
    typeof merc.classId !== 'string' ||
    !ALL_CLASSES.some((cls) => cls.id === merc.classId) ||
    !Number.isInteger(merc.level) ||
    merc.level! < 1 ||
    !merc.aptitudes ||
    typeof merc.aptitudes !== 'object' ||
    !merc.stats ||
    typeof merc.stats !== 'object'
  )
    return null;

  // Progress fields arrived after the first saved rosters; missing means none yet.
  const count = (value: unknown, max: number) =>
    value === undefined
      ? 0
      : Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max
        ? (value as number)
        : null;
  const exp = count(merc.exp, 99999);
  const statPoints = count(merc.statPoints, 9999);
  if (exp === null || statPoints === null) return null;
  if (merc.invested !== undefined && (!merc.invested || typeof merc.invested !== 'object'))
    return null;

  const aptitudes = {} as Aptitudes;
  const stats = {} as MercenaryStats;
  const invested = noInvestment();
  for (const stat of PRIMARY_STATS) {
    const grade = (merc.aptitudes as Partial<Aptitudes>)[stat];
    const points = (merc.stats as Partial<MercenaryStats>)[stat];
    const spent = count(
      (merc.invested as Partial<Record<PrimaryStat, number>> | undefined)?.[stat],
      9999,
    );
    if (!GRADES.includes(grade as Grade)) return null;
    if (!Number.isInteger(points) || points! < 1 || points! > 999) return null;
    if (spent === null) return null;
    aptitudes[stat] = grade!;
    stats[stat] = points!;
    invested[stat] = spent;
  }
  const sp = (merc.stats as Partial<MercenaryStats>).sp;
  if (!Number.isInteger(sp) || sp! < 0 || sp! > 9999) return null;
  stats.sp = sp!;
  return {
    id: merc.id,
    name: merc.name,
    classId: merc.classId,
    level: merc.level!,
    exp,
    statPoints,
    invested,
    aptitudes,
    stats,
  };
}
