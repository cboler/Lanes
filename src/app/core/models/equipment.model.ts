import type { UnitBaseStats } from './stats.model';
import type { Random } from './mercenary.model';

/*
 * Equipment and the forge (Grand Kingdom's equipment system, spec table 4.1.1). Each
 * mercenary has a weapon, an armour and an accessory slot. Weapons come in families and
 * armour in weights that suit some classes; accessories suit anyone. Pieces come in three
 * tiers that open as the squad levels, and the forge reforges a piece up to +5, each step
 * adding a fifth of its bonuses again, for rising gold. Pieces sell back for part of
 * what was spent on them. Pure data and rules; RosterService keeps the armoury.
 */

export type Slot = 'weapon' | 'armor' | 'accessory';
export type StatBonus = Partial<Record<keyof UnitBaseStats, number>>;

export interface EquipmentDefinition {
  readonly id: string;
  readonly name: string;
  readonly slot: Slot;
  /** Class ids that can use it; everyone when unset. */
  readonly classes?: readonly string[];
  readonly tier: 1 | 2 | 3;
  readonly price: number;
  readonly bonus: StatBonus;
}

/** An owned piece: what it is and how far it has been reforged. */
export interface Piece {
  readonly uid: string;
  readonly base: string;
  readonly plus: number;
}

export type Equipped = Partial<Record<Slot, Piece>>;

export const MAX_PLUS = 5;
/** The squad level each tier opens at in the guild armoury. */
export const TIER_LEVEL: Record<1 | 2 | 3, number> = { 1: 1, 2: 4, 3: 8 };
const TIER_PRICE: Record<1 | 2 | 3, number> = { 1: 120, 2: 300, 3: 650 };
const TIER_NAME: Record<1 | 2 | 3, string> = { 1: 'Iron', 2: 'Steel', 3: 'Mythril' };

const weapon = (family: string, classes: string[], stat: keyof UnitBaseStats, base: number) =>
  ([1, 2, 3] as const).map((tier): EquipmentDefinition => ({
    id: `${family.toLowerCase().replace(/\s/g, '-')}-${tier}`,
    name: `${TIER_NAME[tier]} ${family}`,
    slot: 'weapon',
    classes,
    tier,
    price: TIER_PRICE[tier],
    bonus: { [stat]: Math.round(base * [1, 2, 3.3][tier - 1]) },
  }));

const armour = (kind: string, classes: string[], perTier: (tier: number) => StatBonus) =>
  ([1, 2, 3] as const).map((tier): EquipmentDefinition => ({
    id: `${kind.toLowerCase().replace(/\s/g, '-')}-${tier}`,
    name: `${TIER_NAME[tier]} ${kind}`,
    slot: 'armor',
    classes,
    tier,
    price: TIER_PRICE[tier],
    bonus: perTier(tier),
  }));

export const EQUIPMENT: readonly EquipmentDefinition[] = [
  ...weapon('Sword', ['fighter'], 'attack', 6),
  ...weapon('Glaive', ['lancer'], 'attack', 6),
  ...weapon('Longbow', ['archer'], 'attack', 6),
  ...weapon('Musket', ['gunner'], 'attack', 6),
  ...weapon('Staff', ['cleric', 'witch'], 'magicAttack', 6),
  ...armour('Plate', ['fighter', 'lancer'], (t) => ({ defense: 5 * t, maxHp: 12 * t })),
  ...armour('Leathers', ['archer', 'gunner'], (t) => ({ defense: 3 * t, agility: 4 * t })),
  ...armour('Robes', ['cleric', 'witch'], (t) => ({ magicDefense: 6 * t, maxHp: 9 * t })),
  {
    id: 'copper-ring',
    name: 'Copper Ring',
    slot: 'accessory',
    tier: 1,
    price: 150,
    bonus: { maxHp: 20 },
  },
  {
    id: 'hawk-charm',
    name: 'Hawk Charm',
    slot: 'accessory',
    tier: 1,
    price: 180,
    bonus: { technique: 8 },
  },
  {
    id: 'swift-boots',
    name: 'Swift Boots',
    slot: 'accessory',
    tier: 2,
    price: 260,
    bonus: { speed: 6, agility: 6 },
  },
  {
    id: 'warding-amulet',
    name: 'Warding Amulet',
    slot: 'accessory',
    tier: 2,
    price: 320,
    bonus: { defense: 8, magicDefense: 8 },
  },
  {
    id: 'vigil-crest',
    name: 'Vigil Crest',
    slot: 'accessory',
    tier: 3,
    price: 600,
    bonus: { maxHp: 40, vitality: 10 },
  },
];

export function equipment(id: string): EquipmentDefinition | undefined {
  return EQUIPMENT.find((item) => item.id === id);
}

export function canWear(classId: string, item: EquipmentDefinition): boolean {
  return !item.classes || item.classes.includes(classId);
}

/** A piece's bonuses after reforging: each + adds a fifth of the base again. */
export function pieceBonus(piece: Piece): StatBonus {
  const item = equipment(piece.base);
  if (!item) return {};
  const scale = 1 + 0.2 * piece.plus;
  return Object.fromEntries(
    Object.entries(item.bonus).map(([stat, value]) => [stat, Math.round(value! * scale)]),
  );
}

export function pieceName(piece: Piece): string {
  const name = equipment(piece.base)?.name ?? 'Unknown';
  return piece.plus ? `${name} +${piece.plus}` : name;
}

/** Gold to reforge a piece to its next +, or null at the cap. */
export function reforgeCost(piece: Piece): number | null {
  const item = equipment(piece.base);
  if (!item || piece.plus >= MAX_PLUS) return null;
  return Math.round(item.price * 0.5 * (piece.plus + 1));
}

/** What a piece sells for: 40% of its price and of the gold spent reforging it. */
export function sellValue(piece: Piece): number {
  const item = equipment(piece.base);
  if (!item) return 0;
  let spent = item.price;
  for (let plus = 0; plus < piece.plus; plus++) spent += Math.round(item.price * 0.5 * (plus + 1));
  return Math.floor(spent * 0.4);
}

/** Adds every equipped piece's bonuses to a sheet. */
export function applyEquipment(stats: UnitBaseStats, equipped: Equipped = {}): UnitBaseStats {
  const result: Record<string, number> = { ...stats };
  for (const piece of Object.values(equipped)) {
    if (!piece) continue;
    for (const [stat, value] of Object.entries(pieceBonus(piece))) {
      // A class that does not use a stat (a Fighter's magic) gains nothing from it.
      if (stat === 'attack' || stat === 'magicAttack') {
        if (result[stat] > 0) result[stat] += value!;
      } else {
        result[stat] = (result[stat] ?? 0) + value!;
      }
    }
  }
  return result as unknown as UnitBaseStats;
}

/** A saved piece, checked, or null. */
export function parsePiece(value: unknown): Piece | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<Piece>;
  if (
    typeof raw.uid !== 'string' ||
    !raw.uid ||
    typeof raw.base !== 'string' ||
    !equipment(raw.base) ||
    !Number.isInteger(raw.plus) ||
    raw.plus! < 0 ||
    raw.plus! > MAX_PLUS
  )
    return null;
  return { uid: raw.uid, base: raw.base, plus: raw.plus! };
}

/** A mercenary's saved equipment: each slot keeps a valid piece of that slot it can wear. */
export function parseEquipped(value: unknown, classId: string): Equipped {
  const equipped: Equipped = {};
  if (!value || typeof value !== 'object') return equipped;
  for (const slot of ['weapon', 'armor', 'accessory'] as const) {
    const piece = parsePiece((value as Record<string, unknown>)[slot]);
    const item = piece && equipment(piece.base);
    if (piece && item && item.slot === slot && canWear(classId, item)) equipped[slot] = piece;
  }
  return equipped;
}

const STAT_NAMES: Record<keyof UnitBaseStats, string> = {
  maxHp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  speed: 'SPD',
  agility: 'AGI',
  vitality: 'VIT',
  technique: 'TEC',
  magicAttack: 'MAG',
  magicDefense: 'RES',
  meleeRange: 'Reach',
};

/** Bonuses in words, e.g. "+6 ATK · +12 HP". */
export function describeBonus(bonus: StatBonus): string {
  return Object.entries(bonus)
    .map(([stat, value]) => `+${value} ${STAT_NAMES[stat as keyof UnitBaseStats]}`)
    .join(' · ');
}

/** Who can use a piece, in words. */
export function wearers(item: EquipmentDefinition): string {
  return item.classes
    ? item.classes.map((id) => id[0].toUpperCase() + id.slice(1)).join(', ')
    : 'Anyone';
}

/** The best tier the guild armoury sells at a squad level. */
export function openTier(squadLevel: number): 1 | 2 | 3 {
  return squadLevel >= TIER_LEVEL[3] ? 3 : squadLevel >= TIER_LEVEL[2] ? 2 : 1;
}

/** Odds that a piece one tier above the armoury's best drops instead. */
export const RARE_DROP = 0.2;

/**
 * Battle spoils: with the given chance, a piece some class that fought can use, of the
 * armoury's best open tier, or now and then the tier above it. Null when nothing drops.
 */
export function rollDrop(
  random: Random,
  chance: number,
  squadLevel: number,
  classIds: readonly string[],
): string | null {
  if (chance <= 0 || random() >= chance) return null;
  let tier = openTier(squadLevel);
  if (tier < 3 && random() < RARE_DROP) tier = (tier + 1) as 2 | 3;
  const pool = EQUIPMENT.filter(
    (item) =>
      item.tier === tier && (!item.classes || item.classes.some((c) => classIds.includes(c))),
  );
  return pool.length ? pool[Math.floor(random() * pool.length)].id : null;
}
