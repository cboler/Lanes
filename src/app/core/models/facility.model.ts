/*
 * Guild facilities: the company's own wing of the guild hall, upgraded with gold. Each
 * has three levels, every level a lasting effect, and costs rise steeply, so they keep
 * soaking up gold once the squad is equipped.
 */

export type FacilityId = 'barracks' | 'training' | 'infirmary' | 'smithy';
export type Facilities = Partial<Record<FacilityId, number>>;

export interface FacilityDefinition {
  readonly id: FacilityId;
  readonly name: string;
  readonly description: string;
  /** What each level gives, in words. */
  readonly effect: (level: number) => string;
  /** Gold for levels 1, 2 and 3. */
  readonly costs: readonly [number, number, number];
}

export const MAX_FACILITY_LEVEL = 3;
export const BASE_ROSTER_LIMIT = 12;

export const FACILITIES: readonly FacilityDefinition[] = [
  {
    id: 'barracks',
    name: 'Barracks',
    description: 'Bunks for more mercenaries.',
    effect: (level) => `Roster holds ${BASE_ROSTER_LIMIT + 2 * level}`,
    costs: [400, 900, 1600],
  },
  {
    id: 'training',
    name: 'Training Yard',
    description: 'Drills between contracts.',
    effect: (level) => `+${10 * level}% battle EXP`,
    costs: [500, 1100, 2000],
  },
  {
    id: 'infirmary',
    name: 'Infirmary',
    description: 'Surgeons and supplies for the road.',
    effect: (level) => `+${3 * level}% HP mended per march · camp rest ${25 * level}% cheaper`,
    costs: [350, 800, 1400],
  },
  {
    id: 'smithy',
    name: 'Smithy',
    description: 'The company’s own anvil.',
    effect: (level) => `Reforging ${10 * level}% cheaper`,
    costs: [450, 1000, 1800],
  },
];

export function facility(id: FacilityId): FacilityDefinition {
  return FACILITIES.find((f) => f.id === id)!;
}

export function facilityLevel(facilities: Facilities, id: FacilityId): number {
  return facilities[id] ?? 0;
}

/** Gold for a facility's next level, or null once it is fully built. */
export function upgradeCost(facilities: Facilities, id: FacilityId): number | null {
  const level = facilityLevel(facilities, id);
  return level >= MAX_FACILITY_LEVEL ? null : facility(id).costs[level];
}

export function rosterLimit(facilities: Facilities): number {
  return BASE_ROSTER_LIMIT + 2 * facilityLevel(facilities, 'barracks');
}

export function expMultiplier(facilities: Facilities): number {
  return 1 + 0.1 * facilityLevel(facilities, 'training');
}

export function reforgeMultiplier(facilities: Facilities): number {
  return 1 - 0.1 * facilityLevel(facilities, 'smithy');
}

/** Share of max HP mended each step on the map. */
export function marchRecovery(facilities: Facilities): number {
  return 0.05 + 0.03 * facilityLevel(facilities, 'infirmary');
}

export function restMultiplier(facilities: Facilities): number {
  return 1 - 0.25 * facilityLevel(facilities, 'infirmary');
}

export function parseFacilities(value: unknown): Facilities {
  const facilities: Facilities = {};
  if (!value || typeof value !== 'object') return facilities;
  for (const { id } of FACILITIES) {
    const level = (value as Record<string, unknown>)[id];
    if (Number.isInteger(level) && (level as number) > 0) {
      facilities[id] = Math.min(MAX_FACILITY_LEVEL, level as number);
    }
  }
  return facilities;
}
