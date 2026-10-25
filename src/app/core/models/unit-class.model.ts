import { AbilityDefinition } from './ability.model';
import { CombatArchetype, UnitBaseStats, UnitRole } from './stats.model';

export interface UnitClassDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly role: UnitRole;
  readonly archetype: CombatArchetype;
  readonly baseStats: UnitBaseStats;
  /** Skills every mercenary of the class knows from level 1. */
  readonly abilities: readonly AbilityDefinition[];
  /** Skills a mercenary may learn by level, as its skill pattern decides. */
  readonly advancedAbilities: readonly AbilityDefinition[];
  readonly portraitUrl: string;
  /** A battlefield object, not a fighter: it never takes a turn and does not count toward victory. */
  readonly object?: true;
  /** A siege engine: a unit of its side standing beside it can fire its ability. */
  readonly engine?: true;
}

/**
 * A wooden barricade a band raises in a lane (spec 1.1.5). It blocks movement and
 * stands in front of the units behind it, so direct attacks hit it first, until it is
 * broken or flanked through another lane.
 */
export const BARRICADE_CLASS: UnitClassDefinition = {
  id: 'barricade',
  name: 'Barricade',
  description: 'A palisade of sharpened stakes. Blocks the lane until it is broken.',
  role: 'tank',
  archetype: 'specialist',
  baseStats: {
    maxHp: 150,
    attack: 0,
    defense: 30,
    speed: 0,
    agility: 0,
    vitality: 0,
    technique: 0,
    magicAttack: 0,
    magicDefense: 30,
    meleeRange: 0,
  },
  abilities: [],
  advancedAbilities: [],
  portraitUrl: 'assets/units/fighter.jpg',
  object: true,
};

export type EngineKind = 'ballista' | 'catapult' | 'sparkcoil';

/** A siege engine's sheet at level 1; engineStats() scales it with the battle's level. */
function engine(
  id: EngineKind,
  name: string,
  description: string,
  stats: Partial<UnitClassDefinition['baseStats']>,
  ability: AbilityDefinition,
): UnitClassDefinition {
  return {
    id,
    name,
    description,
    role: 'support',
    archetype: 'specialist',
    baseStats: {
      maxHp: 160,
      attack: 0,
      defense: 25,
      speed: 0,
      agility: 0,
      vitality: 0,
      technique: 0,
      magicAttack: 0,
      magicDefense: 25,
      meleeRange: 0,
      ...stats,
    },
    abilities: [ability],
    advancedAbilities: [],
    portraitUrl: 'assets/units/gunner.jpg',
    object: true,
    engine: true,
  };
}

/**
 * Siege engines (spec 1.1.5): scripted battles field them, never defense plans. Any unit
 * of the engine's side within reach of it, in its lane, can spend AP to fire it; the
 * engine's own stats decide the blow.
 */
export const ENGINE_CLASSES: Record<EngineKind, UnitClassDefinition> = {
  ballista: engine(
    'ballista',
    'Ballista',
    'A giant crossbow on a frame. Its bolt pierces every foe down its lane.',
    { maxHp: 170, attack: 70, defense: 30 },
    {
      id: 'ballista_bolt',
      name: 'Ballista Bolt',
      description: 'A spear-length bolt down the engine’s lane: it strikes every foe in that lane.',
      actionCost: 40,
      damageType: 'physical',
      powerMultiplier: 1.3,
      target: 'same-lane-enemies',
    },
  ),
  catapult: engine(
    'catapult',
    'Catapult',
    'A throwing arm that lobs stones over the line onto any lane.',
    { maxHp: 190, attack: 64, defense: 25 },
    {
      id: 'catapult_stone',
      name: 'Catapult Stone',
      description: 'Lob a stone at any foe: it crashes down on every foe in that lane.',
      actionCost: 50,
      damageType: 'physical',
      powerMultiplier: 1.1,
      target: 'single-enemy-any-lane',
      crossLane: true,
      splash: 'lane',
    },
  ),
  sparkcoil: engine(
    'sparkcoil',
    'Sparkcoil',
    'A tinker’s contraption of copper coils that lashes out with lightning.',
    { maxHp: 140, magicAttack: 60, magicDefense: 40 },
    {
      id: 'sparkcoil_shock',
      name: 'Sparkcoil Shock',
      description:
        'Lightning lashes every foe near the coil in its lane, stunning them for a turn.',
      actionCost: 35,
      damageType: 'magical',
      powerMultiplier: 0.7,
      target: 'same-lane-enemies',
      range: 0.35,
      status: { type: 'stun', duration: 1, potency: 0 },
    },
  ),
};

export const FIGHTER_CLASS: UnitClassDefinition = {
  id: 'fighter',
  name: 'Fighter',
  description: 'A heavily-armoured warrior who holds the front line and draws enemy fire.',
  role: 'tank',
  archetype: 'melee',
  baseStats: {
    maxHp: 180,
    attack: 65,
    defense: 50,
    speed: 40,
    agility: 40,
    vitality: 70,
    technique: 60,
    magicAttack: 0,
    magicDefense: 10,
    meleeRange: 1,
  },
  portraitUrl: 'assets/units/fighter.jpg',
  abilities: [
    {
      id: 'shield_bash',
      name: 'Shield Bash',
      description:
        'Strike with the shield edge. Quick, low-cost, and reliable. Knocks the target back.',
      knockback: 0.08,
      actionCost: 20,
      damageType: 'physical',
      powerMultiplier: 0.9,
      target: 'single-enemy',
    },
    {
      id: 'provoke',
      name: 'Provoke',
      description: 'Bellow an intimidating war cry that damages every enemy in this lane.',
      actionCost: 25,
      damageType: 'physical',
      powerMultiplier: 0.5,
      target: 'same-lane-enemies',
    },
    {
      id: 'bulwark',
      name: 'Bulwark',
      description: 'Raise your shield: +25 Defense through your next turn. Cannot stack.',
      actionCost: 30,
      damageType: 'physical',
      powerMultiplier: 0,
      target: 'self',
      status: { type: 'defense-up', duration: 2, potency: 25 },
    },
  ],
  advancedAbilities: [
    {
      id: 'shield_charge',
      name: 'Shield Charge',
      description:
        'Slam into the nearest foe behind your shield, stunning it for a turn. Drives the target far back.',
      knockback: 0.14,
      actionCost: 45,
      damageType: 'physical',
      powerMultiplier: 1.1,
      target: 'single-enemy',
      status: { type: 'stun', duration: 1, potency: 0 },
    },
    {
      id: 'rally',
      name: 'Rally',
      description: 'A rousing cry: +15 Attack for every ally through their next turn.',
      actionCost: 35,
      damageType: 'physical',
      powerMultiplier: 0,
      target: 'all-allies',
      crossLane: true,
      status: { type: 'attack-up', duration: 2, potency: 15 },
    },
    {
      id: 'crushing_blow',
      name: 'Crushing Blow',
      description: 'A heavy overhead strike that dents armour: -15 Defense for two turns.',
      actionCost: 40,
      damageType: 'physical',
      powerMultiplier: 1.5,
      target: 'single-enemy',
      status: { type: 'defense-down', duration: 2, potency: 15 },
    },
    {
      id: 'raise_barricade',
      name: 'Raise Barricade',
      description:
        'Plant a palisade a short way ahead in this lane. It blocks the lane and takes direct blows meant for those behind it.',
      actionCost: 50,
      damageType: 'physical',
      powerMultiplier: 0,
      target: 'self',
      place: 'barricade',
    },
  ],
};

export const CLERIC_CLASS: UnitClassDefinition = {
  id: 'cleric',
  name: 'Cleric',
  description: 'A holy healer who sustains allies and smites foes with divine magic.',
  role: 'support',
  archetype: 'specialist',
  baseStats: {
    maxHp: 120,
    attack: 30,
    defense: 25,
    speed: 55,
    agility: 55,
    vitality: 55,
    technique: 50,
    magicAttack: 70,
    magicDefense: 45,
    meleeRange: 1,
  },
  portraitUrl: 'assets/units/cleric.jpg',
  abilities: [
    {
      id: 'mend',
      name: 'Mend',
      description: 'Channel healing light into one ally anywhere on the field.',
      actionCost: 25,
      damageType: 'healing',
      powerMultiplier: 1.2,
      target: 'single-ally-any-lane',
      crossLane: true,
    },
    {
      id: 'holy_smite',
      name: 'Holy Smite',
      description: 'A burst of divine energy that ignores physical armour.',
      actionCost: 30,
      damageType: 'magical',
      powerMultiplier: 1.0,
      target: 'single-enemy',
    },
    {
      id: 'bless',
      name: 'Bless',
      description: 'Suffuse the entire party with divine grace, restoring HP for all.',
      actionCost: 50,
      damageType: 'healing',
      powerMultiplier: 0.7,
      target: 'all-allies',
      crossLane: true,
    },
  ],
  advancedAbilities: [
    {
      id: 'renew',
      name: 'Renew',
      description: 'A deep restoration for one ally anywhere on the field.',
      actionCost: 40,
      damageType: 'healing',
      powerMultiplier: 1.9,
      target: 'single-ally-any-lane',
      crossLane: true,
    },
    {
      id: 'sanctuary',
      name: 'Sanctuary',
      description: 'Ward the whole party: +15 Defense for every ally through their next turn.',
      actionCost: 40,
      damageType: 'healing',
      powerMultiplier: 0,
      target: 'all-allies',
      crossLane: true,
      status: { type: 'defense-up', duration: 2, potency: 15 },
    },
    {
      id: 'judgement',
      name: 'Judgement',
      description: 'Holy light that falls on any enemy, in any lane.',
      actionCost: 45,
      damageType: 'magical',
      powerMultiplier: 1.4,
      target: 'single-enemy-any-lane',
      crossLane: true,
    },
  ],
};

export const ARCHER_CLASS: UnitClassDefinition = {
  id: 'archer',
  name: 'Archer',
  description:
    'A swift ranged fighter who picks off targets across any lane with deadly precision.',
  role: 'ranged',
  archetype: 'ranged',
  baseStats: {
    maxHp: 110,
    attack: 75,
    defense: 20,
    speed: 75,
    agility: 75,
    vitality: 45,
    technique: 55,
    magicAttack: 0,
    magicDefense: 15,
    meleeRange: 1,
  },
  portraitUrl: 'assets/units/archer.jpg',
  abilities: [
    {
      id: 'quick_shot',
      name: 'Quick Shot',
      description: 'Loose an arrow at one enemy. Fast and reliable.',
      actionCost: 20,
      damageType: 'physical',
      powerMultiplier: 0.85,
      target: 'single-enemy',
    },
    {
      id: 'piercing_arrow',
      name: 'Piercing Arrow',
      description: 'A powerful shot that crosses lanes to reach any target on the field.',
      actionCost: 35,
      damageType: 'physical',
      powerMultiplier: 1.3,
      target: 'single-enemy-any-lane',
      crossLane: true,
    },
    {
      id: 'volley',
      name: 'Volley',
      description: 'Spray arrows across one lane, hitting every enemy within.',
      actionCost: 45,
      damageType: 'physical',
      powerMultiplier: 0.6,
      target: 'same-lane-enemies',
    },
  ],
  advancedAbilities: [
    {
      id: 'poison_arrow',
      name: 'Poison Arrow',
      description: 'A tainted arrow: light damage, then 12 poison damage a turn for three turns.',
      actionCost: 30,
      damageType: 'physical',
      powerMultiplier: 0.7,
      target: 'single-enemy',
      status: { type: 'poison', duration: 3, potency: 12 },
    },
    {
      id: 'pinning_shot',
      name: 'Pinning Shot',
      description: 'Pin any enemy in place, in any lane: it loses its next turn.',
      actionCost: 45,
      damageType: 'physical',
      powerMultiplier: 0.8,
      target: 'single-enemy-any-lane',
      crossLane: true,
      status: { type: 'stun', duration: 1, potency: 0 },
    },
    {
      id: 'arrow_storm',
      name: 'Arrow Storm',
      description: 'Darken the sky over every lane: hits every enemy on the field.',
      actionCost: 55,
      damageType: 'physical',
      powerMultiplier: 0.55,
      target: 'all-enemies',
      crossLane: true,
    },
    {
      id: 'snare_trap',
      name: 'Snare Trap',
      description:
        'Hide a snare further down this lane. The first enemy to cross it, or be knocked into it, is held for a turn.',
      actionCost: 30,
      damageType: 'physical',
      powerMultiplier: 0,
      target: 'self',
      place: 'snare',
    },
  ],
};

export const WITCH_CLASS: UnitClassDefinition = {
  id: 'witch',
  name: 'Witch',
  description: 'A glass-cannon mage who rains devastating AoE magic across the battlefield.',
  role: 'ranged',
  archetype: 'magic',
  baseStats: {
    maxHp: 90,
    attack: 15,
    defense: 15,
    speed: 50,
    agility: 50,
    vitality: 50,
    technique: 40,
    magicAttack: 85,
    magicDefense: 40,
    meleeRange: 1,
  },
  portraitUrl: 'assets/units/witch.jpg',
  abilities: [
    {
      id: 'fire_bolt',
      name: 'Fire Bolt',
      description: 'Hurl a bolt of flame at a single enemy.',
      actionCost: 20,
      damageType: 'magical',
      powerMultiplier: 1.0,
      target: 'single-enemy',
    },
    {
      id: 'inferno',
      name: 'Inferno',
      description: 'Unleash a wave of fire across the entire lane.',
      actionCost: 35,
      damageType: 'magical',
      powerMultiplier: 0.75,
      target: 'same-lane-enemies',
    },
    {
      id: 'meteor',
      name: 'Meteor',
      description:
        'Call down a meteor that strikes ALL units on the field. Beware — allies are not spared.',
      actionCost: 55,
      damageType: 'magical',
      powerMultiplier: 1.4,
      target: 'all-enemies',
      crossLane: true,
      friendlyFire: true,
    },
  ],
  advancedAbilities: [
    {
      id: 'frost_lance',
      name: 'Frost Lance',
      description: 'A shard of ice that numbs: -15 Attack for two turns.',
      actionCost: 30,
      damageType: 'magical',
      powerMultiplier: 1.1,
      target: 'single-enemy',
      status: { type: 'attack-down', duration: 2, potency: 15 },
    },
    {
      id: 'hex',
      name: 'Hex',
      description: 'Curse any enemy, in any lane: -20 Defense for three turns.',
      actionCost: 35,
      damageType: 'magical',
      powerMultiplier: 0.5,
      target: 'single-enemy-any-lane',
      crossLane: true,
      status: { type: 'defense-down', duration: 3, potency: 20 },
    },
    {
      id: 'thunderstorm',
      name: 'Thunderstorm',
      description: 'Lightning that seeks out every enemy, and only enemies.',
      actionCost: 50,
      damageType: 'magical',
      powerMultiplier: 0.8,
      target: 'all-enemies',
      crossLane: true,
    },
  ],
};

export const LANCER_CLASS: UnitClassDefinition = {
  id: 'lancer',
  name: 'Lancer',
  description: 'An aggressive melee striker whose long polearm reaches across lanes.',
  role: 'melee',
  archetype: 'melee',
  baseStats: {
    maxHp: 130,
    attack: 80,
    defense: 30,
    speed: 65,
    agility: 65,
    vitality: 60,
    technique: 45,
    magicAttack: 0,
    magicDefense: 10,
    meleeRange: 2,
  },
  portraitUrl: 'assets/units/lancer.jpg',
  abilities: [
    {
      id: 'thrust',
      name: 'Thrust',
      description: 'A quick jab with the lance tip. Cheap and reliable.',
      actionCost: 15,
      damageType: 'physical',
      powerMultiplier: 0.85,
      target: 'single-enemy',
    },
    {
      id: 'piercing_lunge',
      name: 'Piercing Lunge',
      description: 'Lunge forward with devastating force, reaching into adjacent lanes.',
      actionCost: 30,
      damageType: 'physical',
      powerMultiplier: 1.2,
      target: 'single-enemy-any-lane',
      crossLane: true,
    },
    {
      id: 'whirlwind',
      name: 'Whirlwind',
      description:
        'Spin the lance in a wide arc, striking every enemy in this lane. Sweeps them all back.',
      knockback: 0.06,
      actionCost: 40,
      damageType: 'physical',
      powerMultiplier: 0.7,
      target: 'same-lane-enemies',
    },
  ],
  advancedAbilities: [
    {
      id: 'impale',
      name: 'Impale',
      description: 'Drive the lance home: heavy damage and -10 Defense for two turns.',
      actionCost: 40,
      damageType: 'physical',
      powerMultiplier: 1.6,
      target: 'single-enemy',
      status: { type: 'defense-down', duration: 2, potency: 10 },
    },
    {
      id: 'skewer',
      name: 'Skewer',
      description: 'A running thrust that passes through every enemy in this lane.',
      actionCost: 35,
      damageType: 'physical',
      powerMultiplier: 0.9,
      target: 'same-lane-enemies',
    },
    {
      id: 'battle_trance',
      name: 'Battle Trance',
      description: 'Focus for the kill: +20 Attack through your next turn.',
      actionCost: 30,
      damageType: 'physical',
      powerMultiplier: 0,
      target: 'self',
      status: { type: 'attack-up', duration: 2, potency: 20 },
    },
  ],
};

export const GUNNER_CLASS: UnitClassDefinition = {
  id: 'gunner',
  name: 'Gunner',
  description:
    'A ranged powerhouse whose explosive rounds can devastate a lane — friend and foe alike.',
  role: 'ranged',
  archetype: 'ranged',
  baseStats: {
    maxHp: 100,
    attack: 80,
    defense: 20,
    speed: 60,
    agility: 60,
    vitality: 50,
    technique: 50,
    magicAttack: 0,
    magicDefense: 10,
    meleeRange: 1,
  },
  portraitUrl: 'assets/units/gunner.jpg',
  abilities: [
    {
      id: 'quick_fire',
      name: 'Quick Fire',
      description: 'A rapid shot at one enemy. Fast and reliable.',
      actionCost: 20,
      damageType: 'physical',
      powerMultiplier: 0.9,
      target: 'single-enemy',
    },
    {
      id: 'snipe',
      name: 'Snipe',
      description: 'Take careful aim and fire a high-caliber round at any target on the field.',
      actionCost: 40,
      damageType: 'physical',
      powerMultiplier: 1.5,
      target: 'single-enemy-any-lane',
      crossLane: true,
    },
    {
      id: 'explosive_shot',
      name: 'Explosive Shot',
      description:
        'Fire an explosive round that detonates across the lane. Allies beware! The blast throws enemies back.',
      knockback: 0.06,
      actionCost: 35,
      damageType: 'physical',
      powerMultiplier: 0.65,
      target: 'same-lane-enemies',
      friendlyFire: true,
    },
  ],
  advancedAbilities: [
    {
      id: 'armor_piercer',
      name: 'Armor Piercer',
      description: 'A hardened round for any enemy, in any lane: -20 Defense for two turns.',
      actionCost: 40,
      damageType: 'physical',
      powerMultiplier: 1.1,
      target: 'single-enemy-any-lane',
      crossLane: true,
      status: { type: 'defense-down', duration: 2, potency: 20 },
    },
    {
      id: 'scatter_shot',
      name: 'Scatter Shot',
      description: 'Buckshot across the field: hits every enemy for light damage.',
      actionCost: 40,
      damageType: 'physical',
      powerMultiplier: 0.5,
      target: 'all-enemies',
      crossLane: true,
    },
    {
      id: 'flashbang',
      name: 'Flashbang',
      description: 'A blinding charge down this lane: every enemy in it loses its next turn.',
      actionCost: 55,
      damageType: 'physical',
      powerMultiplier: 0.3,
      target: 'same-lane-enemies',
      status: { type: 'stun', duration: 1, potency: 0 },
    },
  ],
};

export const ALL_CLASSES: readonly UnitClassDefinition[] = [
  FIGHTER_CLASS,
  CLERIC_CLASS,
  ARCHER_CLASS,
  WITCH_CLASS,
  LANCER_CLASS,
  GUNNER_CLASS,
];

export function getClassDefinition(id: string): UnitClassDefinition {
  const found = ALL_CLASSES.find((c) => c.id === id);
  if (!found) {
    throw new Error(`Unit class not found: ${id}`);
  }
  return found;
}
