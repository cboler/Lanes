import { AbilityDefinition } from './ability.model';
import { GRADES, Mercenary, PRIMARY_STATS, PrimaryStat } from './mercenary.model';
import { APTITUDE_RATIO } from './progression.model';
import { ALL_CLASSES } from './unit-class.model';

/*
 * Grand Kingdom's scrolls and grimoires (spec 1.2.3), the answer to unlucky rolls:
 *   Tactics Scroll  raises one stat's aptitude by a grade;
 *   Charm Scroll    refunds every invested stat point, to spend again;
 *   Grimoire        is scribed from a mercenary who has learned an advanced skill, and
 *                   teaches it to another of the same class in place of a pattern skill.
 */

export type ScrollId = 'tactics' | 'charm';
/** A scroll, or `grimoire:<skill id>`. */
export type ItemId = ScrollId | `grimoire:${string}`;
export type Inventory = Partial<Record<ItemId, number>>;

export const SCROLLS: Record<
  ScrollId,
  { readonly name: string; readonly price: number; readonly description: string }
> = {
  tactics: {
    name: 'Tactics Scroll',
    price: 300,
    description:
      'Raises one stat’s aptitude by a grade. Points already invested earn the better rate.',
  },
  charm: {
    name: 'Charm Scroll',
    price: 200,
    description: 'Refunds every stat point a mercenary has invested, to spend again.',
  },
};

/** Gold to scribe a grimoire from a mercenary who knows the skill. */
export const SCRIBE_COST = 150;

/** The advanced skill a grimoire teaches, and its class, or null for anything else. */
export function grimoireSkill(
  item: string,
): { readonly classId: string; readonly skill: AbilityDefinition } | null {
  if (!item.startsWith('grimoire:')) return null;
  const id = item.slice('grimoire:'.length);
  for (const cls of ALL_CLASSES) {
    const skill = cls.advancedAbilities.find((ability) => ability.id === id);
    if (skill) return { classId: cls.id, skill };
  }
  return null;
}

export function itemName(item: ItemId): string {
  if (item in SCROLLS) return SCROLLS[item as ScrollId].name;
  return `Grimoire: ${grimoireSkill(item)?.skill.name ?? 'unknown'}`;
}

/** Bonus points earned so far on a stat: one per `ratio` points invested. */
function bonus(invested: number, merc: Mercenary, stat: PrimaryStat): number {
  return Math.floor(invested / APTITUDE_RATIO[merc.aptitudes[stat]]);
}

/** One grade better, back-paying the better rate on points already invested; null at S. */
export function applyTactics(merc: Mercenary, stat: PrimaryStat): Mercenary | null {
  const grade = GRADES.indexOf(merc.aptitudes[stat]);
  if (grade >= GRADES.length - 1) return null;
  const next = structuredClone(merc);
  next.aptitudes[stat] = GRADES[grade + 1];
  const spent = merc.invested[stat];
  next.stats[stat] += bonus(spent, next, stat) - bonus(spent, merc, stat);
  return next;
}

/** Every invested point back, with the bonus points it earned taken off; null if none. */
export function applyCharm(merc: Mercenary): Mercenary | null {
  const total = PRIMARY_STATS.reduce((sum, stat) => sum + merc.invested[stat], 0);
  if (!total) return null;
  const next = structuredClone(merc);
  for (const stat of PRIMARY_STATS) {
    const spent = merc.invested[stat];
    next.stats[stat] -= spent + bonus(spent, merc, stat);
    next.invested[stat] = 0;
  }
  next.statPoints += total;
  return next;
}

/** A mercenary can scribe a grimoire of a pattern skill it has already learned. */
export function canScribe(merc: Mercenary, skillId: string): boolean {
  return merc.pattern.some((step) => step.id === skillId && step.level <= merc.level);
}

/**
 * Teaches a grimoire's skill in place of one pattern skill, learned at the same level.
 * Null when the grimoire is for another class, or the skill is already in the pattern.
 */
export function applyGrimoire(merc: Mercenary, item: string, replaceId: string): Mercenary | null {
  const found = grimoireSkill(item);
  if (!found || found.classId !== merc.classId) return null;
  if (merc.pattern.some((step) => step.id === found.skill.id)) return null;
  if (!merc.pattern.some((step) => step.id === replaceId)) return null;
  return {
    ...merc,
    pattern: merc.pattern.map((step) =>
      step.id === replaceId ? { id: found.skill.id, level: step.level } : step,
    ),
  };
}

/** Validates a saved inventory: known items with whole, positive counts. */
export function parseInventory(value: unknown): Inventory {
  const inventory: Inventory = {};
  if (!value || typeof value !== 'object') return inventory;
  for (const [item, count] of Object.entries(value)) {
    const known = item in SCROLLS || !!grimoireSkill(item);
    if (known && Number.isInteger(count) && count > 0 && count <= 999) {
      inventory[item as ItemId] = count;
    }
  }
  return inventory;
}

/** Adds (or, with a negative count, takes) items. */
export function addItems(inventory: Inventory, items: readonly ItemId[], count = 1): Inventory {
  const next = { ...inventory };
  for (const item of items) {
    const left = (next[item] ?? 0) + count;
    if (left > 0) next[item] = left;
    else delete next[item];
  }
  return next;
}
