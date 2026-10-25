import { Mercenary, Random, generateMercenary, parseMercenary } from './mercenary.model';
import { autoInvest, gainExp, expToNext } from './progression.model';
import { ALL_CLASSES } from './unit-class.model';
import { FieldObjectSpec, TrapKind, parseObjectSpec } from './field-object.model';
import { SCROLLS, ScrollId } from './item.model';

/*
 * The guild's contract board: battles against named bands of enemy mercenaries, scaled
 * to the squad's level so the fights keep pace as the squad grows. Harder tiers field
 * stronger bands and pay more.
 */

export type ContractTier = 'easy' | 'normal' | 'hard';

export interface Contract {
  id: string;
  /** The enemy band, shown on its troop banner. */
  band: string;
  title: string;
  tier: ContractTier;
  level: number;
  rewardMultiplier: number;
  enemies: Mercenary[];
  /** Barricades and traps the band raises before the battle. */
  objects: FieldObjectSpec[];
  /** Set when this is a campaign mission's battle rather than a board contract. */
  missionId?: string;
  /** A scroll paid on top of the gold when the contract is won. */
  bounty?: ScrollId;
}

export const TIERS: Record<
  ContractTier,
  {
    readonly label: string;
    readonly levelOffset: number;
    readonly size: number;
    readonly reward: number;
  }
> = {
  easy: { label: 'Easy', levelOffset: -1, size: 3, reward: 1.2 },
  normal: { label: 'Normal', levelOffset: 0, size: 4, reward: 1.6 },
  hard: { label: 'Hard', levelOffset: 2, size: 4, reward: 2.2 },
};

const BANDS: readonly { readonly band: string; readonly title: string }[] = [
  { band: 'Grey Wolves', title: 'Wolves on the North Road' },
  { band: 'Ashen Company', title: 'Deserters at the Ford' },
  { band: 'Black Lances', title: 'Raiders in the Vineyards' },
  { band: 'Salt Brothers', title: 'Smugglers at the Harbour' },
  { band: 'Thornguard', title: 'A Grudge at Thorn Keep' },
  { band: 'Red Ravens', title: 'Ravens over the Mill' },
  { band: 'Iron Debt', title: 'Collectors at the Gate' },
  { band: 'Mire Witches', title: 'Lights in the Marsh' },
];

/** Enemy names come from their own pool, so a band never shares a name with the player's roster. */
const ENEMY_NAMES = [
  'Brask',
  'Dagna',
  'Gorm',
  'Hask',
  'Ivra',
  'Kell',
  'Morr',
  'Odo',
  'Pell',
  'Rhea',
  'Sesk',
  'Torv',
  'Ulla',
  'Vex',
  'Yrsa',
  'Zane',
];

/**
 * A mercenary of `level`, as if it had levelled up and invested every point in its
 * class's focus stats in turn, so enemy veterans grow the way a player's would.
 */
export function veteran(classId: string, level: number, random: Random): Mercenary {
  const merc = generateMercenary(classId, random);
  let exp = 0;
  for (let l = 1; l < level; l++) exp += expToNext(l);
  return autoInvest(gainExp(merc, exp));
}

/** A contract of `tier` for a squad of `partyLevel`. Every band has a frontliner first. */
export function generateContract(
  tier: ContractTier,
  partyLevel: number,
  random: Random,
  /** Bands already on the board, so one board never posts the same band twice. */
  takenBands: readonly string[] = [],
): Contract {
  const { levelOffset, size, reward } = TIERS[tier];
  const level = Math.max(1, partyLevel + levelOffset);
  const frontline = ALL_CLASSES.filter((cls) => cls.role === 'tank' || cls.role === 'melee');
  const classes = [
    frontline[Math.floor(random() * frontline.length)],
    ...Array.from(
      { length: size - 1 },
      () => ALL_CLASSES[Math.floor(random() * ALL_CLASSES.length)],
    ),
  ];
  const open = BANDS.filter((entry) => !takenBands.includes(entry.band));
  const pool = open.length ? open : BANDS;
  const { band, title } = pool[Math.floor(random() * pool.length)];
  const enemies: Mercenary[] = [];
  for (const cls of classes) {
    const merc = veteran(cls.id, level, random);
    const free = ENEMY_NAMES.filter((name) => !enemies.some((other) => other.name === name));
    merc.name = free[Math.floor(random() * free.length)];
    enemies.push(merc);
  }
  const id = `contract_${Math.floor(random() * 0xffffffff).toString(36)}`;
  const objects = placeObjects(tier, random);
  const contract: Contract = {
    id,
    band,
    title,
    tier,
    level,
    rewardMultiplier: reward,
    enemies,
    objects,
  };
  // Half of all Hard contracts post a scroll as a bounty.
  if (tier === 'hard' && random() < 0.5) contract.bounty = random() < 0.5 ? 'tactics' : 'charm';
  return contract;
}

/** How many barricades and traps each tier's band raises. */
const OBJECTS: Record<ContractTier, { readonly barricades: number; readonly traps: number }> = {
  easy: { barricades: 0, traps: 1 },
  normal: { barricades: 1, traps: 1 },
  hard: { barricades: 1, traps: 2 },
};

/**
 * Barricades stand just ahead of the band's front line; traps wait in the middle of the
 * field, where the player's units must walk to close in. No two traps share a lane.
 */
function placeObjects(tier: ContractTier, random: Random): FieldObjectSpec[] {
  const { barricades, traps } = OBJECTS[tier];
  const lanes = [0, 1, 2];
  const objects: FieldObjectSpec[] = [];
  for (let i = 0; i < barricades; i++) {
    objects.push({ kind: 'barricade', lane: lanes[Math.floor(random() * 3)], x: 0.6 });
  }
  for (let i = 0; i < traps; i++) {
    const [lane] = lanes.splice(Math.floor(random() * lanes.length), 1);
    const trap: TrapKind = random() < 0.5 ? 'spikes' : 'snare';
    objects.push({ kind: 'trap', trap, lane, x: Math.round((0.44 + random() * 0.12) * 100) / 100 });
  }
  return objects;
}

/** One contract of each tier. */
export function generateBoard(partyLevel: number, random: Random): Contract[] {
  const board: Contract[] = [];
  for (const tier of ['easy', 'normal', 'hard'] as const) {
    board.push(
      generateContract(
        tier,
        partyLevel,
        random,
        board.map((c) => c.band),
      ),
    );
  }
  return board;
}

/** Validates a saved contract, or null. */
export function parseContract(value: unknown): Contract | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<Contract>;
  if (
    typeof raw.id !== 'string' ||
    typeof raw.band !== 'string' ||
    typeof raw.title !== 'string' ||
    !raw.tier ||
    !(raw.tier in TIERS) ||
    !Number.isInteger(raw.level) ||
    raw.level! < 1 ||
    typeof raw.rewardMultiplier !== 'number' ||
    !Array.isArray(raw.enemies) ||
    raw.enemies.length < 1 ||
    raw.enemies.length > 4
  )
    return null;
  const enemies = raw.enemies.map(parseMercenary);
  // Contracts saved before objects existed have none.
  const objects = Array.isArray(raw.objects) ? raw.objects.map(parseObjectSpec) : [];
  if (objects.some((spec) => !spec)) return null;
  if (enemies.some((merc) => !merc)) return null;
  return {
    id: raw.id,
    band: raw.band,
    title: raw.title,
    tier: raw.tier,
    level: raw.level!,
    // Never trust a saved multiplier: the tier decides it.
    rewardMultiplier: TIERS[raw.tier].reward,
    enemies: enemies as Mercenary[],
    objects: objects as FieldObjectSpec[],
    ...(typeof raw.bounty === 'string' && raw.bounty in SCROLLS ? { bounty: raw.bounty } : {}),
  };
}
