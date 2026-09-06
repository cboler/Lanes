import { describe, it, expect, beforeEach } from 'vitest';
import { BattleStateService, COLLISION_BUFFER } from './battle-state.service';
import { FIGHTER_CLASS, ARCHER_CLASS, CLERIC_CLASS } from '../models/unit-class.model';

describe('BattleStateService', () => {
  let service: BattleStateService;

  beforeEach(() => {
    service = new BattleStateService();
  });

  it('initializes skirmish with 3 player and 3 enemy units across lanes with vanguard positioning', () => {
    service.initSkirmish();

    expect(service.units().length).toBe(6);
    expect(service.playerUnits().length).toBe(3);
    expect(service.enemyUnits().length).toBe(3);
    expect(service.activeUnit()).not.toBeNull();
    expect(service.battleStatus()).toBe('active');
    expect(service.roundNumber()).toBe(1);

    // Fighter (tank) should be in frontline (0.32), Archer/Cleric in rear (0.14)
    const playerFighter = service.playerUnits().find((u) => u.classDef.id === 'fighter')!;
    const playerArcher = service.playerUnits().find((u) => u.classDef.id === 'archer')!;
    expect(playerFighter.positionX).toBeGreaterThan(playerArcher.positionX);
  });

  it('switches lane for active player unit when affordable and unblocked', () => {
    service.initSkirmish([FIGHTER_CLASS], [FIGHTER_CLASS]);
    const active = service.activeUnit();
    expect(active).not.toBeNull();
    expect(active?.team).toBe('player');
    expect(active?.lane).toBe(0);

    const switched = service.switchActiveUnitLane(1);
    expect(switched).toBe(true);
    expect(service.activeUnit()?.lane).toBe(1);
  });

  it('prevents lane switch if target lane space is occupied by another unit', () => {
    service.initSkirmish([FIGHTER_CLASS], [FIGHTER_CLASS]);
    const active = service.activeUnit()!;
    // Place enemy in lane 1 at the exact same positionX
    const enemy = service.enemyUnits()[0];
    enemy.lane = 1;
    enemy.positionX = active.positionX;

    const switched = service.switchActiveUnitLane(1);
    expect(switched).toBe(false);
    expect(active.lane).toBe(0);
    expect(service.combatLogs()[0]).toContain('space occupied');
  });

  it('moves active player unit horizontally in lane and blocks collision', () => {
    service.initSkirmish([FIGHTER_CLASS], [FIGHTER_CLASS]);
    const active = service.activeUnit()!;
    const initialPos = active.positionX;

    const moved = service.moveActiveUnit(0.1);
    expect(moved).toBe(true);
    expect(active.positionX).toBeCloseTo(initialPos + 0.1, 3);

    // Place an obstacle in same lane ahead of unit
    const enemy = service.enemyUnits()[0];
    enemy.lane = active.lane;
    enemy.positionX = active.positionX + 0.1;

    // Moving forward should stop at collision buffer
    service.moveActiveUnit(0.2);
    expect(active.positionX).toBeLessThanOrEqual(enemy.positionX - COLLISION_BUFFER + 0.001);
  });

  it('allows selecting abilities and detects valid targets', () => {
    service.initSkirmish([ARCHER_CLASS], [CLERIC_CLASS]);
    const active = service.activeUnit()!;

    // Select Quick Shot (single-enemy in same lane)
    const quickShot = active.classDef.abilities[0];
    service.selectAbility(quickShot.id);
    expect(service.selectedAbility()?.id).toBe(quickShot.id);

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

  it('toggles auto battle and auto battle speed', () => {
    expect(service.isAutoBattle()).toBe(false);
    service.toggleAutoBattle();
    expect(service.isAutoBattle()).toBe(true);
    service.toggleAutoBattle();
    expect(service.isAutoBattle()).toBe(false);

    expect(service.autoBattleSpeed()).toBe('1x');
    service.toggleAutoSpeed();
    expect(service.autoBattleSpeed()).toBe('2x');
  });
});
