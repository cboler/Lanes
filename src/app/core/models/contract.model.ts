import {
  CLASS_FOCUS,
  Mercenary,
  Random,
  generateMercenary,
  parseMercenary,
} from './mercenary.model';
import { gainExp, expToNext, investPoint } from './progression.model';
import { ALL_CLASSES } from './unit-class.model';

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
  let merc = generateMercenary(classId, random);
  let exp = 0;
  for (let l = 1; l < level; l++) exp += expToNext(l);
  merc = gainExp(merc, exp);
  const focus = CLASS_FOCUS[classId] ?? ['str'];
  for (let i = 0; merc.statPoints > 0; i++) merc = investPoint(merc, focus[i % focus.length])!;
  return merc;
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
  return { id, band, title, tier, level, rewardMultiplier: reward, enemies };
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
  };
}
