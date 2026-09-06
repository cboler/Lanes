import { DamageType } from './stats.model';

/**
 * Defines valid targeting scopes for an ability.
 */
export type AbilityTarget =
  | 'single-enemy'
  | 'single-ally'
  | 'same-lane-enemies'
  | 'single-enemy-any-lane'
  | 'single-ally-any-lane'
  | 'all-enemies'
  | 'all-allies';

/**
 * Immutable definition of a single combat ability.
 */
export interface AbilityDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly actionCost: number;
  readonly damageType: DamageType;
  readonly powerMultiplier: number;
  readonly target: AbilityTarget;
  readonly crossLane?: boolean;
  readonly friendlyFire?: boolean;
}
