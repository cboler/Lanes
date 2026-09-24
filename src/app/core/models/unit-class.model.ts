import { AbilityDefinition } from './ability.model';
import { CombatArchetype, UnitBaseStats, UnitRole } from './stats.model';

export interface UnitClassDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly role: UnitRole;
  readonly archetype: CombatArchetype;
  readonly baseStats: UnitBaseStats;
  readonly abilities: readonly AbilityDefinition[];
  readonly portraitUrl: string;
}

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
      description: 'Strike with the shield edge. Quick, low-cost, and reliable.',
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
      target: 'single-ally',
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
      description: 'Spin the lance in a wide arc, striking every enemy in this lane.',
      actionCost: 40,
      damageType: 'physical',
      powerMultiplier: 0.7,
      target: 'same-lane-enemies',
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
      description: 'Fire an explosive round that detonates across the lane. Allies beware!',
      actionCost: 35,
      damageType: 'physical',
      powerMultiplier: 0.65,
      target: 'same-lane-enemies',
      friendlyFire: true,
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
