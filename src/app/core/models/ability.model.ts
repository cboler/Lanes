import { DamageType } from './stats.model';
import { StatusEffectType } from './status-effect.model';

/**
 * Defines valid targeting scopes for an ability.
 */
export type AbilityTarget =
  | 'self'
  | 'single-enemy'
  | 'single-ally'
  | 'same-lane-enemies'
  | 'single-enemy-any-lane'
  | 'single-ally-any-lane'
  | 'all-enemies'
  | 'all-allies';

/** A status a skill leaves on everyone it hits (or buffs). Recasting refreshes it rather than stacking. */
export interface AbilityStatus {
  readonly type: StatusEffectType;
  /** Turns it lasts, counted at the end of the target's own turns. */
  readonly duration: number;
  /** Stat change for buffs and debuffs, or damage per turn for poison. */
  readonly potency: number;
}

/** A battlefield object a skill sets down ahead of its user, in the user's lane. */
export type PlacedObject = 'barricade' | 'spikes' | 'snare';

/**
 * Immutable definition of a single combat ability.
 */
export interface AbilityDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly actionCost: number;
  readonly damageType: DamageType;
  /** 0 for a pure buff or debuff: no damage, only the status. */
  readonly powerMultiplier: number;
  readonly target: AbilityTarget;
  readonly crossLane?: boolean;
  readonly friendlyFire?: boolean;
  readonly status?: AbilityStatus;
  /** Shoves enemies hit back along their lane by this share of the field's width. */
  readonly knockback?: number;
  /** Sets down a barricade or trap instead of striking anyone (target 'self', power 0). */
  readonly place?: PlacedObject;
}
