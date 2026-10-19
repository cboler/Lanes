import { AbilityDefinition } from './ability.model';
import { UnitBaseStats } from './stats.model';
import { getClassDefinition } from './unit-class.model';

/*
 * Grand Kingdom's skill patterns (spec 1.2.3): every mercenary of a class knows its core
 * skills, but which advanced skills it can learn, and at which levels, is rolled once when
 * it is created. Hunting for a recruit with the right pattern is part of the hiring loop.
 * Support skills are passives equipped with SP.
 */

/** One step of a skill pattern: an advanced skill and the level it is learned at. */
export interface PatternStep {
  readonly id: string;
  readonly level: number;
}

/** How many of the class's advanced skills one pattern teaches. */
export const PATTERN_LENGTH = 2;
/** The level ranges the first and second pattern skills are learned in. */
const PATTERN_LEVELS: readonly (readonly [number, number])[] = [
  [2, 4],
  [5, 8],
];

/** Rolls a pattern: some of the class's advanced skills, in random order, at random levels. */
export function rollPattern(classId: string, random: () => number): PatternStep[] {
  const pool = [...getClassDefinition(classId).advancedAbilities];
  const steps: PatternStep[] = [];
  for (const [from, to] of PATTERN_LEVELS.slice(0, PATTERN_LENGTH)) {
    const [skill] = pool.splice(Math.floor(random() * pool.length), 1);
    steps.push({ id: skill.id, level: from + Math.floor(random() * (to - from + 1)) });
  }
  return steps;
}

/** Validates a saved pattern against its class, or null. */
export function parsePattern(classId: string, value: unknown): PatternStep[] | null {
  if (!Array.isArray(value) || value.length > PATTERN_LENGTH) return null;
  const pool = getClassDefinition(classId).advancedAbilities;
  const steps: PatternStep[] = [];
  for (const raw of value as unknown[]) {
    const step = raw as Partial<PatternStep> | null;
    if (
      !step ||
      typeof step.id !== 'string' ||
      !pool.some((skill) => skill.id === step.id) ||
      steps.some((other) => other.id === step.id) ||
      !Number.isInteger(step.level) ||
      step.level! < 1 ||
      step.level! > 99
    )
      return null;
    steps.push({ id: step.id, level: step.level! });
  }
  return steps;
}

export function patternSkill(classId: string, step: PatternStep): AbilityDefinition {
  return getClassDefinition(classId).advancedAbilities.find((skill) => skill.id === step.id)!;
}

/** The skills a mercenary can use at its level: core skills, then pattern skills learned so far. */
export function knownAbilities(merc: {
  readonly classId: string;
  readonly level: number;
  readonly pattern: readonly PatternStep[];
}): AbilityDefinition[] {
  return [
    ...getClassDefinition(merc.classId).abilities,
    ...merc.pattern
      .filter((step) => step.level <= merc.level)
      .map((step) => patternSkill(merc.classId, step)),
  ];
}

// ---------------------------------------------------------------------------
// Support skills

/** A passive equipped with SP. Stat bonuses scale the derived combat stats. */
export interface SupportSkill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  /** The level a mercenary must reach to equip it. */
  readonly level: number;
  /** Fractional bonuses to derived combat stats, e.g. 0.1 for +10%. */
  readonly stats?: Partial<Record<keyof UnitBaseStats, number>>;
}

export const SUPPORT_SKILLS: readonly SupportSkill[] = [
  {
    id: 'iron_skin',
    name: 'Iron Skin',
    description: '+10% Defense and Magic Defense.',
    cost: 4,
    level: 1,
    stats: { defense: 0.1, magicDefense: 0.1 },
  },
  {
    id: 'vigor',
    name: 'Vigor',
    description: '+10% max HP.',
    cost: 4,
    level: 1,
    stats: { maxHp: 0.1 },
  },
  {
    id: 'precision_fire',
    name: 'Precision Fire',
    description: 'The aiming cursor sweeps 25% slower.',
    cost: 5,
    level: 2,
  },
  {
    id: 'rhythm',
    name: 'Rhythm',
    description: 'The Just Cancel flash lasts 50% longer.',
    cost: 5,
    level: 2,
  },
  {
    id: 'fleet_foot',
    name: 'Fleet Foot',
    description: '+10% Speed and Agility: earlier turns and more Move Gauge.',
    cost: 5,
    level: 3,
    stats: { speed: 0.1, agility: 0.1 },
  },
  {
    id: 'second_wind',
    name: 'Second Wind',
    description: '+10% Vitality: more Action Gauge each turn.',
    cost: 5,
    level: 3,
    stats: { vitality: 0.1 },
  },
  {
    id: 'might',
    name: 'Might',
    description: '+10% Attack and Magic Attack.',
    cost: 8,
    level: 5,
    stats: { attack: 0.1, magicAttack: 0.1 },
  },
];

export function supportSkill(id: string): SupportSkill | undefined {
  return SUPPORT_SKILLS.find((skill) => skill.id === id);
}

export function supportCost(ids: readonly string[]): number {
  return ids.reduce((sum, id) => sum + (supportSkill(id)?.cost ?? 0), 0);
}

/** Whether a mercenary may add `id` to its equipped supports. */
export function canEquipSupport(
  merc: {
    readonly level: number;
    readonly supports: readonly string[];
    readonly stats: { readonly sp: number };
  },
  id: string,
): boolean {
  const skill = supportSkill(id);
  return (
    !!skill &&
    !merc.supports.includes(id) &&
    merc.level >= skill.level &&
    supportCost(merc.supports) + skill.cost <= merc.stats.sp
  );
}

/** Applies equipped supports' stat bonuses to derived combat stats. */
export function applySupports(stats: UnitBaseStats, supports: readonly string[]): UnitBaseStats {
  const result: Record<string, number> = { ...stats };
  for (const id of supports) {
    for (const [stat, bonus] of Object.entries(supportSkill(id)?.stats ?? {})) {
      const base = result[stat];
      if (base > 0) result[stat] = Math.round(base * (1 + bonus!));
    }
  }
  return result as unknown as UnitBaseStats;
}
