import { ALL_CLASSES, UnitClassDefinition } from '../src/app/core/models/unit-class.model';
import { ContractTier, generateContract, veteran } from '../src/app/core/models/contract.model';
import { Mercenary, Random } from '../src/app/core/models/mercenary.model';
import { armed, openTier } from '../src/app/core/models/equipment.model';
import { allMissions, missionContract } from '../src/app/core/models/campaign.model';
import { BattleRecord, runBattle } from './battle';
import { ProfileId } from './profiles';

/*
 * The battles each report is built from. Every scenario draws its squads from one seeded
 * random, so the same seed and size always give the same results.
 */

export type GearLevel = 'none' | 'armoury';

/** One cell of a scenario grid and the battles fought in it. */
export interface Cell {
  readonly scenario: 'classes' | 'mirrors' | 'contracts' | 'campaign';
  readonly profile: ProfileId;
  readonly level?: number;
  readonly tier?: ContractTier;
  readonly gear?: GearLevel;
  readonly mission?: string;
  readonly records: BattleRecord[];
}

const FRONTLINE = ALL_CLASSES.filter((cls) => cls.role === 'tank' || cls.role === 'melee');
const pickClass = (random: Random, from = ALL_CLASSES) => from[Math.floor(random() * from.length)];

/** A squad as players tend to field one: a frontliner and three of anything. */
function squadClasses(random: Random): UnitClassDefinition[] {
  return [pickClass(random, FRONTLINE), pickClass(random), pickClass(random), pickClass(random)];
}

function squad(level: number, gear: GearLevel, random: Random): Mercenary[] {
  return squadClasses(random).map((cls, index) => {
    const merc = { ...veteran(cls.id, level, random), id: `sim_${index}_${cls.id}` };
    return gear === 'armoury' ? armed(merc, openTier(level)) : merc;
  });
}

/** Class troops (no mercenaries) in random 4v4s: which classes win, and which side. */
export function classBalance(battles: number, random: Random): Cell {
  const records = Array.from({ length: battles }, () =>
    runBattle(
      { kind: 'classes', player: squadClasses(random), enemy: squadClasses(random) },
      'ai',
      random,
    ),
  );
  return { scenario: 'classes', profile: 'ai', records };
}

/** The same squad on both sides: a fair game wins about half. */
export function mirrors(battles: number, random: Random): Cell {
  const records = Array.from({ length: battles }, () => {
    const classes = squadClasses(random);
    return runBattle({ kind: 'classes', player: classes, enemy: classes }, 'ai', random);
  });
  return { scenario: 'mirrors', profile: 'ai', records };
}

export const CONTRACT_LEVELS = [1, 4, 8, 12] as const;
export const TIER_ORDER: readonly ContractTier[] = ['easy', 'normal', 'hard'];
export const PLAYER_PROFILES: readonly ProfileId[] = ['novice', 'average', 'expert'];
export const GEAR_LEVELS: readonly GearLevel[] = ['none', 'armoury'];

/** Guild contracts: every tier at several squad levels, for each kind of player. */
export function contracts(battles: number, random: Random): Cell[] {
  const cells: Cell[] = [];
  for (const level of CONTRACT_LEVELS) {
    for (const tier of TIER_ORDER) {
      for (const gear of GEAR_LEVELS) {
        for (const profile of PLAYER_PROFILES) {
          const records = Array.from({ length: battles }, () =>
            runBattle(
              {
                kind: 'contract',
                squad: squad(level, gear, random),
                contract: generateContract(tier, level, random),
              },
              profile,
              random,
            ),
          );
          cells.push({ scenario: 'contracts', profile, level, tier, gear, records });
        }
      }
    }
  }
  return cells;
}

/** Each story mission, fought by a squad at the mission's level. */
export function campaign(battles: number, random: Random): Cell[] {
  const cells: Cell[] = [];
  for (const mission of allMissions()) {
    const contract = missionContract(mission);
    for (const gear of GEAR_LEVELS) {
      for (const profile of PLAYER_PROFILES) {
        const records = Array.from({ length: battles }, () =>
          runBattle(
            { kind: 'contract', squad: squad(mission.level, gear, random), contract },
            profile,
            random,
          ),
        );
        cells.push({
          scenario: 'campaign',
          profile,
          level: mission.level,
          gear,
          mission: mission.id,
          records,
        });
      }
    }
  }
  return cells;
}
