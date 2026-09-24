/**
 * Unit combat roles used for formation and tactical hints.
 */
export type UnitRole = 'tank' | 'melee' | 'ranged' | 'support';

export type CombatArchetype = 'melee' | 'ranged' | 'magic' | 'specialist';

/**
 * Combat damage types supported by the calculator.
 */
export type DamageType = 'physical' | 'magical' | 'healing';

/**
 * Immutable baseline stats defining a unit class's combat profile.
 */
export interface UnitBaseStats {
  readonly maxHp: number;
  readonly attack: number;
  readonly defense: number;
  readonly speed: number;
  readonly agility: number;
  readonly vitality: number;
  readonly technique: number;
  readonly magicAttack: number;
  readonly magicDefense: number;
  readonly meleeRange: number;
}
