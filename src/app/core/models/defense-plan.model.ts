import { Mercenary, parseMercenary } from './mercenary.model';
import { AbilityDefinition } from './ability.model';
import { knownAbilities } from './skills.model';

export const DEFENSE_PRIORITIES = ['lowest-hp', 'closest', 'leader', 'front-lane'] as const;
export type DefenseTargetPriority = (typeof DEFENSE_PRIORITIES)[number];

export interface DefenseOrder {
  abilityId: string;
  targetPriority: DefenseTargetPriority;
}

/**
 * One defender: a snapshot of a roster mercenary and its four turns of orders. The
 * snapshot makes a plan self-contained, as an async-PvP defense sent to another player
 * would have to be.
 */
export interface DefenseMember {
  mercenary: Mercenary;
  orders: DefenseOrder[];
}

export interface DefensePlan {
  version: 2;
  members: DefenseMember[];
}

export const DEFENSE_LIMIT = 4;
/** Classes the default defense prefers, in order: the old class-based default lineup. */
const DEFAULT_LINEUP = ['lancer', 'gunner', 'witch', 'fighter'];

export function autoOrders(): DefenseOrder[] {
  return Array.from({ length: 4 }, () => ({ abilityId: 'auto', targetPriority: 'closest' }));
}

/** Up to four roster mercenaries with automatic orders, preferring the default lineup. */
export function createDefaultDefensePlan(roster: readonly Mercenary[]): DefensePlan {
  const picked: Mercenary[] = [];
  for (const classId of DEFAULT_LINEUP) {
    const merc = roster.find((m) => m.classId === classId && !picked.includes(m));
    if (merc) picked.push(merc);
  }
  for (const merc of roster) {
    if (picked.length < DEFENSE_LIMIT && !picked.includes(merc)) picked.push(merc);
  }
  return {
    version: 2,
    members: picked.map((merc) => ({ mercenary: structuredClone(merc), orders: autoOrders() })),
  };
}

/** Orders may use Guard, auto, or any skill the defender knows at its level. */
function parseOrders(known: readonly AbilityDefinition[], value: unknown): DefenseOrder[] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const orders: DefenseOrder[] = [];
  for (const raw of value as unknown[]) {
    if (!raw || typeof raw !== 'object') return null;
    const order = raw as Partial<DefenseOrder>;
    if (
      typeof order.abilityId !== 'string' ||
      (!['auto', 'guard'].includes(order.abilityId) &&
        !known.some((ability) => ability.id === order.abilityId)) ||
      !DEFENSE_PRIORITIES.includes(order.targetPriority as DefenseTargetPriority)
    )
      return null;
    orders.push({ abilityId: order.abilityId, targetPriority: order.targetPriority! });
  }
  return orders;
}

/**
 * Validate saved input once, then use only this sanitized copy in battle. A member whose
 * mercenary is still in `roster` takes the roster's current sheet. A version 1 plan (class
 * only) is upgraded by giving each member an unused roster mercenary of its class; it is
 * rejected if the roster has none.
 */
export function parseDefensePlan(
  value: unknown,
  roster: readonly Mercenary[] = [],
): DefensePlan | null {
  if (!value || typeof value !== 'object') return null;
  const plan = value as { version?: unknown; members?: unknown };
  if (
    (plan.version !== 1 && plan.version !== 2) ||
    !Array.isArray(plan.members) ||
    plan.members.length < 1 ||
    plan.members.length > DEFENSE_LIMIT
  )
    return null;

  const members: DefenseMember[] = [];
  for (const candidate of plan.members as unknown[]) {
    if (!candidate || typeof candidate !== 'object') return null;
    const raw = candidate as { classId?: unknown; mercenary?: unknown; orders?: unknown };
    let mercenary: Mercenary | null;
    if (plan.version === 1) {
      const found = roster.find(
        (m) => m.classId === raw.classId && !members.some((member) => member.mercenary.id === m.id),
      );
      mercenary = found ? structuredClone(found) : null;
    } else {
      mercenary = parseMercenary(raw.mercenary);
      const current = mercenary && roster.find((m) => m.id === mercenary!.id);
      if (current && current.classId === mercenary!.classId) mercenary = structuredClone(current);
    }
    if (!mercenary || members.some((member) => member.mercenary.id === mercenary!.id)) return null;
    const orders = parseOrders(knownAbilities(mercenary), raw.orders);
    if (!orders) return null;
    members.push({ mercenary, orders });
  }
  return { version: 2, members };
}
