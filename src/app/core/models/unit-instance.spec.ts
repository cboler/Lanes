import { describe, it, expect } from 'vitest';
import { UnitInstance } from './unit-instance.model';
import { FIGHTER_CLASS } from './unit-class.model';
import { StatusEffectInstance } from './status-effect.model';

describe('UnitInstance', () => {
  it('initializes with base stats and max HP', () => {
    const unit = new UnitInstance(FIGHTER_CLASS, 'Baleroc', 'player', 0, 0.3);
    expect(unit.name).toBe('Baleroc');
    expect(unit.currentHp).toBe(FIGHTER_CLASS.baseStats.maxHp);
    expect(unit.isAlive).toBe(true);
    expect(unit.lane).toBe(0);
    expect(unit.positionX).toBe(0.3);
  });

  it('calculates damage and healing correctly with clamping', () => {
    const unit = new UnitInstance(FIGHTER_CLASS, 'Baleroc', 'player');
    const lost = unit.takeDamage(50);
    expect(lost).toBe(50);
    expect(unit.currentHp).toBe(FIGHTER_CLASS.baseStats.maxHp - 50);

    const healed = unit.heal(30);
    expect(healed).toBe(30);
    expect(unit.currentHp).toBe(FIGHTER_CLASS.baseStats.maxHp - 20);

    // Over-heal clamped to maxHp
    unit.heal(100);
    expect(unit.currentHp).toBe(FIGHTER_CLASS.baseStats.maxHp);

    // Over-damage clamped to 0
    unit.takeDamage(500);
    expect(unit.currentHp).toBe(0);
    expect(unit.isAlive).toBe(false);
  });

  it('handles stat buffs and debuffs', () => {
    const unit = new UnitInstance(FIGHTER_CLASS, 'Baleroc', 'player');
    const baseAtk = unit.stats.attack;

    unit.applyStatusEffect(new StatusEffectInstance('attack-up', 2, 15));
    expect(unit.effectiveAttack).toBe(baseAtk + 15);

    unit.applyStatusEffect(new StatusEffectInstance('attack-down', 1, 10));
    expect(unit.effectiveAttack).toBe(baseAtk + 15 - 10);
  });

  it('ticks status effects and applies poison damage', () => {
    const unit = new UnitInstance(FIGHTER_CLASS, 'Baleroc', 'player');
    unit.applyStatusEffect(new StatusEffectInstance('poison', 2, 20));
    unit.applyStatusEffect(new StatusEffectInstance('stun', 1, 0));

    expect(unit.isStunned).toBe(true);

    const poisonDmg = unit.tickStatusEffects();
    expect(poisonDmg).toBe(20);
    expect(unit.currentHp).toBe(FIGHTER_CLASS.baseStats.maxHp - 20);
    // Stun had 1 turn, ticked down to 0, so expired and removed
    expect(unit.isStunned).toBe(false);
  });
});
