import { ALL_CLASSES, getClassDefinition } from './unit-class.model';

export const DEFENSE_PRIORITIES = ['lowest-hp', 'closest', 'leader', 'front-lane'] as const;
export type DefenseTargetPriority = (typeof DEFENSE_PRIORITIES)[number];

export interface DefenseOrder {
  abilityId: string;
  targetPriority: DefenseTargetPriority;
}

export interface DefenseMember {
  classId: string;
  orders: DefenseOrder[];
}

export interface DefensePlan {
  version: 1;
  members: DefenseMember[];
}

export function createDefaultDefensePlan(): DefensePlan {
  return {
    version: 1,
    members: ['lancer', 'gunner', 'witch', 'fighter'].map((classId) => ({
      classId,
      orders: Array.from({ length: 4 }, () => ({ abilityId: 'auto', targetPriority: 'closest' })),
    })),
  };
}

/** Validate saved input once, then use only this sanitized copy in battle. */
export function parseDefensePlan(value: unknown): DefensePlan | null {
  if (!value || typeof value !== 'object') return null;
  const plan = value as Partial<DefensePlan>;
  if (
    plan.version !== 1 ||
    !Array.isArray(plan.members) ||
    plan.members.length < 1 ||
    plan.members.length > 4
  )
    return null;

  const members: DefenseMember[] = [];
  for (const candidate of plan.members as unknown[]) {
    if (!candidate || typeof candidate !== 'object') return null;
    const member = candidate as Partial<DefenseMember>;
    if (
      typeof member.classId !== 'string' ||
      !ALL_CLASSES.some((cls) => cls.id === member.classId) ||
      !Array.isArray(member.orders) ||
      member.orders.length !== 4
    )
      return null;
    const cls = getClassDefinition(member.classId);
    const orders: DefenseOrder[] = [];
    for (const raw of member.orders as unknown[]) {
      if (!raw || typeof raw !== 'object') return null;
      const order = raw as Partial<DefenseOrder>;
      if (
        typeof order.abilityId !== 'string' ||
        (!['auto', 'guard'].includes(order.abilityId) &&
          !cls.abilities.some((ability) => ability.id === order.abilityId)) ||
        !DEFENSE_PRIORITIES.includes(order.targetPriority as DefenseTargetPriority)
      )
        return null;
      orders.push({ abilityId: order.abilityId, targetPriority: order.targetPriority! });
    }
    members.push({ classId: cls.id, orders });
  }
  return { version: 1, members };
}
