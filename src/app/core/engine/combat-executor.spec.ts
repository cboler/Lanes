import { describe, it, expect } from 'vitest';
import { CombatExecutor } from './combat-executor';
import { UnitInstance } from '../models/unit-instance.model';
import { FIGHTER_CLASS, CLERIC_CLASS, WITCH_CLASS, GUNNER_CLASS } from '../models/unit-class.model';

describe('CombatExecutor', () => {
  it('executes single target attack and spends gauge', () => {
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Hero Fighter', 'player', 1);
    const enemy = new UnitInstance(FIGHTER_CLASS, 'Enemy Fighter', 'enemy', 1);

    const bash = FIGHTER_CLASS.abilities[0]; // cost 20
    const initialHp = enemy.currentHp;

    const result = CombatExecutor.execute(fighter, bash, [enemy]);
    expect(result.success).toBe(true);
    expect(result.effects.length).toBe(1);
    expect(result.effects[0].isHealing).toBe(false);
    expect(result.effects[0].amount).toBeGreaterThan(0);
    expect(enemy.currentHp).toBe(initialHp - result.effects[0].amount);
    expect(fighter.actionGauge.current).toBe(100 - bash.actionCost);
  });

  it('fails if attacker has insufficient action gauge', () => {
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Hero Fighter', 'player', 1);
    const enemy = new UnitInstance(FIGHTER_CLASS, 'Enemy Fighter', 'enemy', 1);
    fighter.actionGauge.trySpend(90); // 10 remaining, bash needs 20

    const bash = FIGHTER_CLASS.abilities[0];
    const result = CombatExecutor.execute(fighter, bash, [enemy]);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('gauge');
  });

  it('fails if attacker is dead', () => {
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Hero Fighter', 'player', 1);
    const enemy = new UnitInstance(FIGHTER_CLASS, 'Enemy Fighter', 'enemy', 1);
    fighter.takeDamage(fighter.maxHp);

    const bash = FIGHTER_CLASS.abilities[0];
    const result = CombatExecutor.execute(fighter, bash, [enemy]);
    expect(result.success).toBe(false);
  });

  it('handles healing abilities on allies', () => {
    const cleric = new UnitInstance(CLERIC_CLASS, 'Hero Cleric', 'player', 1);
    const injuredFighter = new UnitInstance(FIGHTER_CLASS, 'Hero Fighter', 'player', 1);
    injuredFighter.takeDamage(50);
    const hpBefore = injuredFighter.currentHp;

    const mend = CLERIC_CLASS.abilities[0];
    const result = CombatExecutor.execute(cleric, mend, [injuredFighter]);

    expect(result.success).toBe(true);
    expect(result.effects[0].isHealing).toBe(true);
    expect(injuredFighter.currentHp).toBeGreaterThan(hpBefore);
  });

  it('applies friendly fire for explosive or meteor attacks', () => {
    const witch = new UnitInstance(WITCH_CLASS, 'Hero Witch', 'player', 1);
    const ally = new UnitInstance(FIGHTER_CLASS, 'Hero Ally', 'player', 1);
    const enemy1 = new UnitInstance(FIGHTER_CLASS, 'Enemy 1', 'enemy', 0);
    const enemy2 = new UnitInstance(FIGHTER_CLASS, 'Enemy 2', 'enemy', 1);

    const meteor = WITCH_CLASS.abilities[2]; // Meteor, friendlyFire = true
    const allUnits = [witch, ally, enemy1, enemy2];

    const result = CombatExecutor.execute(witch, meteor, [enemy1, enemy2], allUnits);
    expect(result.success).toBe(true);

    // Should hit enemy1, enemy2, AND ally due to friendly fire
    const hitUnits = result.effects.map((e) => e.target.id);
    expect(hitUnits).toContain(enemy1.id);
    expect(hitUnits).toContain(enemy2.id);
    expect(hitUnits).toContain(ally.id);
    expect(hitUnits).not.toContain(witch.id); // Caster excluded
  });

  it('identifies valid targets accurately based on lane and reach', () => {
    const gunner = new UnitInstance(GUNNER_CLASS, 'Hero Gunner', 'player', 1, 0.2);
    const enemySameLane = new UnitInstance(FIGHTER_CLASS, 'Enemy 1', 'enemy', 1, 0.7);
    const enemyOtherLane = new UnitInstance(FIGHTER_CLASS, 'Enemy 2', 'enemy', 0, 0.7);
    const ally = new UnitInstance(FIGHTER_CLASS, 'Hero Ally', 'player', 1, 0.1);

    const all = [gunner, enemySameLane, enemyOtherLane, ally];

    // Quick Fire: single-enemy in same lane
    const quickFire = GUNNER_CLASS.abilities[0];
    const sameLaneTargets = CombatExecutor.getValidTargets(gunner, quickFire, all);
    expect(sameLaneTargets).toEqual([enemySameLane]);

    // Snipe: single-enemy-any-lane
    const snipe = GUNNER_CLASS.abilities[1];
    const anyLaneTargets = CombatExecutor.getValidTargets(gunner, snipe, all);
    expect(anyLaneTargets).toContain(enemySameLane);
    expect(anyLaneTargets).toContain(enemyOtherLane);
    expect(anyLaneTargets).not.toContain(ally);
  });

  it('blocks direct attacks to backline units when a frontline enemy is in the way', () => {
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Hero Fighter', 'player', 1, 0.2);
    const frontlineEnemy = new UnitInstance(FIGHTER_CLASS, 'Frontline Tank', 'enemy', 1, 0.65);
    const backlineEnemy = new UnitInstance(WITCH_CLASS, 'Backline Witch', 'enemy', 1, 0.85);

    const all = [fighter, frontlineEnemy, backlineEnemy];

    // Direct single-enemy attack (Shield Bash) can only target frontmost enemy
    const shieldBash = FIGHTER_CLASS.abilities[0];
    const targets = CombatExecutor.getValidTargets(fighter, shieldBash, all);
    expect(targets).toEqual([frontlineEnemy]);
    expect(targets).not.toContain(backlineEnemy);
  });
});
