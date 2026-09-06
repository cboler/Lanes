import { describe, it, expect, beforeEach } from 'vitest';
import { BattleStateService } from './battle-state.service';
import { FIGHTER_CLASS, ARCHER_CLASS, CLERIC_CLASS } from '../models/unit-class.model';

describe('BattleStateService', () => {
  let service: BattleStateService;

  beforeEach(() => {
    service = new BattleStateService();
  });

  it('initializes skirmish with 3 player and 3 enemy units across lanes', () => {
    service.initSkirmish();

    expect(service.units().length).toBe(6);
    expect(service.playerUnits().length).toBe(3);
    expect(service.enemyUnits().length).toBe(3);
    expect(service.activeUnit()).not.toBeNull();
    expect(service.battleStatus()).toBe('active');
    expect(service.roundNumber()).toBe(1);
  });

  it('switches lane for active player unit when affordable', () => {
    // Force first unit to be player fighter
    service.initSkirmish([FIGHTER_CLASS], [FIGHTER_CLASS]);
    const active = service.activeUnit();
    expect(active).not.toBeNull();
    expect(active?.team).toBe('player');
    expect(active?.lane).toBe(0);

    const switched = service.switchActiveUnitLane(1);
    expect(switched).toBe(true);
    expect(service.activeUnit()?.lane).toBe(1);
  });

  it('moves active player unit horizontally in lane', () => {
    service.initSkirmish([FIGHTER_CLASS], [FIGHTER_CLASS]);
    const initialPos = service.activeUnit()!.positionX;

    const moved = service.moveActiveUnit(0.1);
    expect(moved).toBe(true);
    expect(service.activeUnit()!.positionX).toBeCloseTo(initialPos + 0.1, 3);
  });

  it('allows selecting abilities and detects valid targets', () => {
    service.initSkirmish([ARCHER_CLASS], [CLERIC_CLASS]);
    const active = service.activeUnit()!;

    // Select Quick Shot (single-enemy in same lane)
    const quickShot = active.classDef.abilities[0];
    service.selectAbility(quickShot.id);
    expect(service.selectedAbility()?.id).toBe(quickShot.id);

    // Both are in lane 0
    const valid = service.validTargets();
    expect(valid.length).toBe(1);
    expect(valid[0].team).toBe('enemy');
  });

  it('executes ability and updates logs and damage', () => {
    service.initSkirmish([FIGHTER_CLASS], [FIGHTER_CLASS]);
    const active = service.activeUnit()!;
    const enemy = service.enemyUnits()[0];
    const initialHp = enemy.currentHp;

    service.selectAbility(active.classDef.abilities[0].id);
    const executed = service.executeSelectedAbility(enemy);

    expect(executed).toBe(true);
    expect(enemy.currentHp).toBeLessThan(initialHp);
    expect(service.combatLogs().length).toBeGreaterThan(2);
  });
});
