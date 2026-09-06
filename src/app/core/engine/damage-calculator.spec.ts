import { describe, it, expect } from 'vitest';
import { DamageCalculator } from './damage-calculator';
import { UnitInstance } from '../models/unit-instance.model';
import { FIGHTER_CLASS, WITCH_CLASS, CLERIC_CLASS } from '../models/unit-class.model';
import { AbilityDefinition } from '../models/ability.model';

describe('DamageCalculator', () => {
  const fighter = new UnitInstance(FIGHTER_CLASS, 'Hero Fighter', 'player');
  const enemyFighter = new UnitInstance(FIGHTER_CLASS, 'Enemy Fighter', 'enemy');
  const witch = new UnitInstance(WITCH_CLASS, 'Hero Witch', 'player');
  const cleric = new UnitInstance(CLERIC_CLASS, 'Hero Cleric', 'player');

  it('calculates physical damage mitigated by defense', () => {
    const bash: AbilityDefinition = FIGHTER_CLASS.abilities[0]; // Shield bash, 0.9 power
    // fighter.effectiveAttack = 65, 65 * 0.9 = 58.5 -> floor 58
    // enemyFighter defense = 50
    // net = 58 - 50 = 8
    const damage = DamageCalculator.calculateWithDefense(fighter, enemyFighter, bash);
    expect(damage).toBe(8);
  });

  it('ensures minimum 1 damage even against high defense', () => {
    const weakAttack: AbilityDefinition = {
      id: 'chip',
      name: 'Chip',
      description: '',
      actionCost: 10,
      damageType: 'physical',
      powerMultiplier: 0.1,
      target: 'single-enemy',
    };
    const damage = DamageCalculator.calculateWithDefense(fighter, enemyFighter, weakAttack);
    expect(damage).toBe(1);
  });

  it('calculates magical damage mitigated by magicDefense', () => {
    const fireBolt: AbilityDefinition = WITCH_CLASS.abilities[0]; // 1.0 power, matk = 85
    // enemyFighter.magicDefense = 10
    // net = 85 - 10 = 75
    const damage = DamageCalculator.calculateWithDefense(witch, enemyFighter, fireBolt);
    expect(damage).toBe(75);
  });

  it('calculates healing ignoring defense', () => {
    const mend: AbilityDefinition = CLERIC_CLASS.abilities[0]; // 1.2 power, matk = 70
    // raw = 70 * 1.2 = 84
    const heal = DamageCalculator.calculateWithDefense(cleric, fighter, mend);
    expect(heal).toBe(84);
  });
});
