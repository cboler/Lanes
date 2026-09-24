import { describe, it, expect } from 'vitest';
import { UnitInstance } from './unit-instance.model';
import { ARCHER_CLASS, FIGHTER_CLASS } from './unit-class.model';
import { StatusEffectInstance } from './status-effect.model';

describe('UnitInstance', () => {
  it('initializes with base stats and max HP', () => {
    const unit = new UnitInstance(FIGHTER_CLASS, 'Baleroc', 'player', 0, 0.3);
    expect(unit.name).toBe('Baleroc');
    expect(unit.currentHp).toBe(FIGHTER_CLASS.baseStats.maxHp);
    expect(unit.isAlive).toBe(true);
    expect(unit.lane).toBe(0);
    expect(unit.positionX).toBe(0.3);
    expect(unit.actionGauge.current).toBe(100);
    expect(unit.moveGauge.current).toBe(100);
    expect(unit.guardPoints).toBe(0);
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

  it('recovers partially on later turns and gives AGI and VIT distinct benefits', () => {
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Fighter');
    const archer = new UnitInstance(ARCHER_CLASS, 'Archer');
    for (const unit of [fighter, archer]) {
      unit.moveGauge.exhaust();
      unit.actionGauge.exhaust();
      unit.startTurn();
      expect(unit.moveGauge.current).toBeGreaterThan(0);
      expect(unit.moveGauge.current).toBeLessThan(unit.moveGauge.max);
      expect(unit.actionGauge.current).toBeGreaterThan(0);
      expect(unit.actionGauge.current).toBeLessThan(unit.actionGauge.max);
    }
    expect(archer.moveGauge.current).toBeGreaterThan(fighter.moveGauge.current);
    expect(fighter.actionGauge.current).toBeGreaterThan(archer.actionGauge.current);
  });

  it('preserves unspent resources across turns and caps both gauges', () => {
    const unit = new UnitInstance(FIGHTER_CLASS, 'Fighter');
    unit.moveGauge.trySpend(90);
    unit.actionGauge.trySpend(80);
    unit.startTurn();
    expect(unit.moveGauge.current).toBe(55);
    expect(unit.actionGauge.current).toBe(80);
    unit.startTurn();
    expect(unit.moveGauge.current).toBe(100);
    expect(unit.actionGauge.current).toBe(100);
  });

  it('converts only remaining action into guard without spending move or stacking', () => {
    const unit = new UnitInstance(FIGHTER_CLASS, 'Fighter');
    unit.actionGauge.trySpend(60);
    expect(unit.guardPotential).toBe(44);
    expect(unit.enterGuard()).toBe(44);
    expect(unit.guardPoints).toBe(44);
    expect(unit.actionGauge.current).toBe(0);
    expect(unit.moveGauge.current).toBe(100);
    expect(unit.enterGuard()).toBe(0);
    expect(unit.guardPoints).toBe(44);
  });

  it('strengthens guard with technique', () => {
    const skilled = new UnitInstance(FIGHTER_CLASS, 'Skilled');
    const novice = new UnitInstance(
      {
        ...FIGHTER_CLASS,
        baseStats: { ...FIGHTER_CLASS.baseStats, technique: 0 },
      },
      'Novice',
    );
    expect(skilled.guardPotential).toBeGreaterThan(novice.guardPotential);
    expect(novice.enterGuard()).toBe(50);
  });

  it('absorbs direct hits until guard breaks and expires it at the next own turn', () => {
    const unit = new UnitInstance(FIGHTER_CLASS, 'Fighter');
    unit.actionGauge.trySpend(60);
    unit.enterGuard();
    expect(unit.takeDamage(20)).toBe(0);
    expect(unit.guardPoints).toBe(24);
    expect(unit.takeDamage(30)).toBe(6);
    expect(unit.guardPoints).toBe(0);
    expect(unit.currentHp).toBe(unit.maxHp - 6);
    unit.startTurn();
    unit.enterGuard();
    expect(unit.guardPoints).toBeGreaterThan(0);
    unit.startTurn();
    expect(unit.guardPoints).toBe(0);
    expect(unit.takeDamage(10)).toBe(10);
  });

  it('poison bypasses guard without consuming its absorption', () => {
    const unit = new UnitInstance(FIGHTER_CLASS, 'Fighter');
    const guard = unit.enterGuard();
    unit.applyStatusEffect(new StatusEffectInstance('poison', 1, 20));
    expect(unit.tickStatusEffects()).toBe(20);
    expect(unit.currentHp).toBe(unit.maxHp - 20);
    expect(unit.guardPoints).toBe(guard);
  });

  it('does not guard when dead, stunned, or out of actions', () => {
    const dead = new UnitInstance(FIGHTER_CLASS, 'Dead');
    dead.takeDamage(dead.maxHp);
    const stunned = new UnitInstance(FIGHTER_CLASS, 'Stunned');
    stunned.applyStatusEffect(new StatusEffectInstance('stun', 2));
    const exhausted = new UnitInstance(FIGHTER_CLASS, 'Exhausted');
    exhausted.actionGauge.exhaust();
    for (const unit of [dead, stunned, exhausted]) {
      expect(unit.enterGuard()).toBe(0);
      expect(unit.guardPoints).toBe(0);
    }
  });

  it('fully resets HP, both gauges, guard and effects for a new battle', () => {
    const unit = new UnitInstance(FIGHTER_CLASS, 'Fighter');
    unit.takeDamage(20);
    unit.moveGauge.exhaust();
    unit.enterGuard();
    unit.applyStatusEffect(new StatusEffectInstance('poison', 2, 10));
    unit.resetForBattle();
    expect(unit.currentHp).toBe(unit.maxHp);
    expect(unit.moveGauge.current).toBe(100);
    expect(unit.actionGauge.current).toBe(100);
    expect(unit.guardPoints).toBe(0);
    expect(unit.statusEffects).toHaveLength(0);
  });
});
