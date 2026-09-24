import { describe, it, expect } from 'vitest';
import { CombatExecutor } from './combat-executor';
import { UnitInstance } from '../models/unit-instance.model';
import { FIGHTER_CLASS, CLERIC_CLASS, WITCH_CLASS, GUNNER_CLASS } from '../models/unit-class.model';
import { StatusEffectInstance } from '../models/status-effect.model';

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
    expect(fighter.moveGauge.current).toBe(100);
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
    expect(result.effects[0].amount).toBe(50);
    expect(result.effects[0].guardAbsorbed).toBe(0);
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

  it('reports guard absorption separately from actual HP damage', () => {
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Attacker', 'player');
    const enemy = new UnitInstance(FIGHTER_CLASS, 'Defender', 'enemy');
    enemy.actionGauge.trySpend(95);
    expect(enemy.enterGuard()).toBe(5);
    const result = CombatExecutor.execute(fighter, FIGHTER_CLASS.abilities[0], [enemy]);
    expect(result.effects[0].amount).toBe(3);
    expect(result.effects[0].guardAbsorbed).toBe(5);
    expect(enemy.currentHp).toBe(enemy.maxHp - 3);
    expect(enemy.guardPoints).toBe(0);
  });

  it('spends an attack and reports zero HP damage when fully blocked by guard', () => {
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Attacker', 'player');
    const enemy = new UnitInstance(FIGHTER_CLASS, 'Defender', 'enemy');
    enemy.enterGuard();
    const result = CombatExecutor.execute(fighter, FIGHTER_CLASS.abilities[0], [enemy]);
    expect(result.success).toBe(true);
    expect(result.effects[0].amount).toBe(0);
    expect(result.effects[0].guardAbsorbed).toBe(8);
    expect(enemy.currentHp).toBe(enemy.maxHp);
    expect(fighter.actionGauge.current).toBe(80);
  });

  it('reports only remaining HP when an attack defeats a target', () => {
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Attacker', 'player');
    const enemy = new UnitInstance(FIGHTER_CLASS, 'Defender', 'enemy');
    enemy.takeDamage(enemy.maxHp - 3);
    const result = CombatExecutor.execute(fighter, FIGHTER_CLASS.abilities[0], [enemy]);
    expect(result.effects[0].amount).toBe(3);
    expect(result.effects[0].wasDefeated).toBe(true);
    expect(enemy.currentHp).toBe(0);
  });

  it('allows an attack with an exhausted move gauge', () => {
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Attacker', 'player');
    const enemy = new UnitInstance(FIGHTER_CLASS, 'Defender', 'enemy');
    fighter.moveGauge.exhaust();
    expect(CombatExecutor.execute(fighter, FIGHTER_CLASS.abilities[0], [enemy]).success).toBe(true);
    expect(fighter.moveGauge.current).toBe(0);
    expect(fighter.actionGauge.current).toBe(80);
  });

  it('rejects a stunned attacker without spending or damaging', () => {
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Attacker', 'player');
    const enemy = new UnitInstance(FIGHTER_CLASS, 'Defender', 'enemy');
    fighter.applyStatusEffect(new StatusEffectInstance('stun', 1));
    expect(CombatExecutor.execute(fighter, FIGHTER_CLASS.abilities[0], [enemy]).success).toBe(
      false,
    );
    expect(fighter.actionGauge.current).toBe(100);
    expect(enemy.currentHp).toBe(enemy.maxHp);
  });

  it('rejects a forged copy of an owned skill without spending', () => {
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Attacker', 'player');
    const enemy = new UnitInstance(FIGHTER_CLASS, 'Defender', 'enemy');
    const forged = { ...FIGHTER_CLASS.abilities[0], actionCost: 0, powerMultiplier: 100 };
    expect(CombatExecutor.execute(fighter, forged, [enemy]).success).toBe(false);
    expect(fighter.actionGauge.current).toBe(100);
    expect(enemy.currentHp).toBe(enemy.maxHp);
  });

  it.each(['empty', 'dead', 'ally', 'off-lane', 'foreign', 'duplicate', 'backline'])(
    'rejects %s targets without spending resources or changing HP',
    (invalidCase) => {
      const fighter = new UnitInstance(FIGHTER_CLASS, 'Attacker', 'player', 1, 0.2);
      const enemy = new UnitInstance(FIGHTER_CLASS, 'Defender', 'enemy', 1, 0.7);
      const ally = new UnitInstance(FIGHTER_CLASS, 'Ally', 'player', 1, 0.1);
      const front = new UnitInstance(FIGHTER_CLASS, 'Front', 'enemy', 1, 0.6);
      let selected: UnitInstance[] = [enemy];
      let battlefield = [fighter, enemy, ally];
      switch (invalidCase) {
        case 'empty':
          selected = [];
          break;
        case 'dead':
          enemy.takeDamage(enemy.maxHp);
          break;
        case 'ally':
          selected = [ally];
          break;
        case 'off-lane':
          enemy.lane = 2;
          break;
        case 'foreign':
          battlefield = [fighter, ally];
          break;
        case 'duplicate':
          selected = [enemy, enemy];
          break;
        case 'backline':
          battlefield.push(front);
          break;
      }
      const previousHp = enemy.currentHp;
      const result = CombatExecutor.execute(
        fighter,
        FIGHTER_CLASS.abilities[0],
        selected,
        battlefield,
      );
      expect(result.success).toBe(false);
      expect(result.effects).toHaveLength(0);
      expect(fighter.actionGauge.current).toBe(100);
      expect(fighter.moveGauge.current).toBe(100);
      expect(enemy.currentHp).toBe(previousHp);
    },
  );

  it('rejects multiple targets for a single-target healing skill', () => {
    const cleric = new UnitInstance(CLERIC_CLASS, 'Cleric');
    const ally = new UnitInstance(FIGHTER_CLASS, 'Ally');
    const result = CombatExecutor.execute(cleric, CLERIC_CLASS.abilities[0], [cleric, ally]);
    expect(result.success).toBe(false);
    expect(cleric.actionGauge.current).toBe(100);
  });

  it('requires every valid area target when battlefield context is supplied', () => {
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Attacker', 'player');
    const enemies = [
      new UnitInstance(FIGHTER_CLASS, 'Enemy 1', 'enemy'),
      new UnitInstance(FIGHTER_CLASS, 'Enemy 2', 'enemy'),
    ];
    const provoke = FIGHTER_CLASS.abilities[1];
    expect(
      CombatExecutor.execute(fighter, provoke, [enemies[0]], [fighter, ...enemies]).success,
    ).toBe(false);
    expect(fighter.actionGauge.current).toBe(100);
    const result = CombatExecutor.execute(fighter, provoke, enemies, [fighter, ...enemies]);
    expect(result.success).toBe(true);
    expect(result.effects).toHaveLength(2);
    expect(fighter.actionGauge.current).toBe(75);
  });

  it('Bulwark buffs only its caster without causing damage, stacking or friendly fire', () => {
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Fighter');
    const ally = new UnitInstance(FIGHTER_CLASS, 'Ally');
    const bulwark = FIGHTER_CLASS.abilities[2];
    expect(CombatExecutor.getValidTargets(fighter, bulwark, [fighter, ally])).toEqual([fighter]);
    expect(CombatExecutor.execute(fighter, bulwark, [ally], [fighter, ally]).success).toBe(false);
    expect(fighter.actionGauge.current).toBe(100);
    const result = CombatExecutor.execute(fighter, bulwark, [fighter], [fighter, ally]);
    expect(result.success).toBe(true);
    expect(result.effects[0].statusApplied).toBe('defense-up');
    expect(result.effects[0].amount).toBe(0);
    expect(result.effects[0].isFriendlyFire).toBe(false);
    expect(fighter.currentHp).toBe(fighter.maxHp);
    expect(fighter.effectiveDefense).toBe(75);
    expect(fighter.actionGauge.current).toBe(70);
    expect(CombatExecutor.execute(fighter, bulwark, [fighter]).success).toBe(false);
    expect(fighter.actionGauge.current).toBe(70);
    fighter.tickStatusEffects();
    expect(fighter.effectiveDefense).toBe(75);
    fighter.tickStatusEffects();
    expect(fighter.effectiveDefense).toBe(50);
  });
});
