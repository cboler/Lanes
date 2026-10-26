import type { Random } from '../src/app/core/models/mercenary.model';
import type { AimGrade, ChainGrade } from '../src/app/core/engine/execution';

/*
 * How well a simulated player times the execution bar. The AI fires everything at normal
 * power (no grade); these profiles stand in for people. The odds are assumptions to tune
 * against playtests, not measurements.
 */

export type ProfileId = 'ai' | 'novice' | 'average' | 'expert';

export interface SkillProfile {
  readonly id: ProfileId;
  readonly label: string;
  /** Odds of each grade when aiming a ranged or magic skill. */
  readonly aim: Readonly<Record<AimGrade, number>> | null;
  /** Odds of each follow-up press in a melee combo; the rest of the time the combo is dropped. */
  readonly combo: Readonly<Partial<Record<ChainGrade, number>>> | null;
}

export const PROFILES: Readonly<Record<ProfileId, SkillProfile>> = {
  ai: { id: 'ai', label: 'AI timing (always normal)', aim: null, combo: null },
  novice: {
    id: 'novice',
    label: 'Novice',
    aim: { critical: 0.05, hit: 0.45, graze: 0.35, miss: 0.15 },
    combo: { just: 0.1, chain: 0.5 },
  },
  average: {
    id: 'average',
    label: 'Average',
    aim: { critical: 0.15, hit: 0.55, graze: 0.22, miss: 0.08 },
    combo: { just: 0.25, chain: 0.55 },
  },
  expert: {
    id: 'expert',
    label: 'Expert',
    aim: { critical: 0.4, hit: 0.5, graze: 0.08, miss: 0.02 },
    combo: { just: 0.6, chain: 0.35 },
  },
};

/** Draws one outcome from a table of odds; whatever the table leaves over is `rest`. */
export function draw<T extends string>(
  random: Random,
  odds: Readonly<Partial<Record<T, number>>>,
  rest?: T,
): T | undefined {
  let roll = random();
  for (const [grade, chance] of Object.entries(odds) as [T, number][]) {
    if (roll < chance) return grade;
    roll -= chance;
  }
  return rest;
}
