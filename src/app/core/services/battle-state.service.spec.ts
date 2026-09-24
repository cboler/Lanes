import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BattleStateService, COLLISION_BUFFER } from './battle-state.service';
import { FIGHTER_CLASS, ARCHER_CLASS, CLERIC_CLASS } from '../models/unit-class.model';
import { StatusEffectInstance } from '../models/status-effect.model';

describe('BattleStateService', () => {
  let service: BattleStateService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new BattleStateService();
  });

  afterEach(() => {
    service.suspend();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('initializes skirmish with 4 player and 4 enemy units across lanes with vanguard positioning', () => {
    service.initSkirmish();

    expect(service.units().length).toBe(8);
    expect(service.playerUnits().length).toBe(4);
    expect(service.enemyUnits().length).toBe(4);
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

  it('spends independent movement and action gauges', () => {
    service.initSkirmish([ARCHER_CLASS], [FIGHTER_CLASS]);
    const unit = service.activeUnit()!;
    expect(service.moveActiveUnit(0.04)).toBe(true);
    expect(unit.moveGauge.current).toBe(98);
    expect(unit.actionGauge.current).toBe(100);
    service.selectAbility('quick_shot');
    expect(service.executeSelectedAbility()).toBe(true);
    expect(unit.moveGauge.current).toBe(98);
    expect(unit.actionGauge.current).toBe(80);
    expect(service.switchActiveUnitLane(1)).toBe(true);
    expect(unit.moveGauge.current).toBe(83);
    expect(unit.actionGauge.current).toBe(80);
  });

  it('guards until its own next turn and recovers only that unit on turn start', () => {
    service.initSkirmish([ARCHER_CLASS, CLERIC_CLASS], [FIGHTER_CLASS]);
    const archer = service.activeUnit()!;
    const cleric = service.playerUnits()[1];
    archer.actionGauge.trySpend(20);
    archer.moveGauge.exhaust();
    cleric.actionGauge.exhaust();
    service.endCurrentTurn();
    expect(archer.guardPoints).toBe(84);
    expect(archer.actionGauge.current).toBe(0);
    expect(service.activeUnit()).toBe(cleric);
    expect(cleric.actionGauge.current).toBe(cleric.actionRecovery);
    service.endCurrentTurn();
    service.endCurrentTurn(true);
    expect(service.activeUnit()).toBe(archer);
    expect(archer.guardPoints).toBe(0);
    expect(archer.actionGauge.current).toBe(archer.actionRecovery);
    expect(archer.moveGauge.current).toBe(archer.moveRecovery);
  });

  it('refreshes and rotates initiative after turns, deaths, and restart', () => {
    service.initSkirmish();
    const first = service.activeUnit()!;
    expect(service.turnOrder()[0]).toBe(first);
    service.endCurrentTurn();
    expect(service.turnOrder()[0]).toBe(service.activeUnit());
    expect(service.turnOrder().at(-1)).toBe(first);
    const victim = service.enemyUnits()[0];
    victim.takeDamage(victim.maxHp, true);
    service.units.update((units) => [...units]);
    expect(service.turnOrder()).not.toContain(victim);
    service.initSkirmish([ARCHER_CLASS], [FIGHTER_CLASS]);
    expect(service.turnOrder()).toHaveLength(2);
    expect(service.turnOrder()).not.toContain(first);
  });

  it('prevents paused auto actions from advancing or damaging a later manual turn', () => {
    service.initSkirmish();
    const first = service.activeUnit()!;
    service.toggleAutoBattle();
    service.toggleAutoBattle();
    vi.advanceTimersByTime(5000);
    expect(service.activeUnit()).toBe(first);
    expect(first.actionGauge.current).toBe(100);
    service.toggleAutoBattle();
    vi.advanceTimersByTime(600);
    service.toggleAutoBattle();
    const hp = service.units().map((unit) => unit.currentHp);
    service.endCurrentTurn();
    const next = service.activeUnit();
    vi.advanceTimersByTime(5000);
    expect(service.activeUnit()).toBe(next);
    expect(service.units().map((unit) => unit.currentHp)).toEqual(hp);
  });

  it('suspends a battle during navigation without granting another turn recovery', () => {
    service.initSkirmish();
    service.toggleAutoBattle();
    const first = service.activeUnit()!;
    first.actionGauge.trySpend(10);
    service.suspend();
    vi.advanceTimersByTime(5000);
    expect(first.actionGauge.current).toBe(90);
    service.resume();
    expect(first.actionGauge.current).toBe(90);
    vi.advanceTimersByTime(600);
    expect(first.actionGauge.current).toBeLessThan(90);
  });

  it('blocks manual inputs during enemy, stunned, auto, and completed turns', () => {
    service.initSkirmish([FIGHTER_CLASS], [FIGHTER_CLASS]);
    const player = service.activeUnit()!;
    player.applyStatusEffect(new StatusEffectInstance('stun', 1));
    service.units.update((units) => [...units]);
    expect(service.moveActiveUnit(0.04)).toBe(false);
    expect(service.switchActiveUnitLane(1)).toBe(false);
    service.selectAbility('shield_bash');
    expect(service.executeSelectedAbility()).toBe(false);
    service.endCurrentTurn();
    expect(service.activeUnit()).toBe(player);
    player.clearStatusEffects();
    service.units.update((units) => [...units]);
    service.toggleAutoBattle();
    expect(service.moveActiveUnit(0.04)).toBe(false);
    service.toggleAutoBattle();
    service.endCurrentTurn();
    expect(service.activeUnit()?.team).toBe('enemy');
    expect(service.moveActiveUnit(0.04)).toBe(false);
    service.battleStatus.set('victory');
    expect(service.moveActiveUnit(0.04)).toBe(false);
  });

  it('keeps four-member starting positions separate and preserves the chosen squad on restart', () => {
    service.initSkirmish(
      [FIGHTER_CLASS, FIGHTER_CLASS, FIGHTER_CLASS, FIGHTER_CLASS],
      [FIGHTER_CLASS],
    );
    const [first, , , fourth] = service.playerUnits();
    expect(first.lane).toBe(fourth.lane);
    expect(Math.abs(first.positionX - fourth.positionX)).toBeGreaterThan(COLLISION_BUFFER);
    service.toggleAutoBattle();
    service.initSkirmish();
    expect(service.playerUnits().every((unit) => unit.classDef.id === 'fighter')).toBe(true);
    expect(service.isAutoBattle()).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(service.playerUnits().every((unit) => unit.currentHp === unit.maxHp)).toBe(true);
  });

  it.each([
    ['default squads', undefined, undefined],
    ['guard-heavy mirror', [FIGHTER_CLASS], [FIGHTER_CLASS]],
  ] as const)(
    'finishes auto combat for %s and stops issuing turns after the result',
    (_name, players, enemies) => {
      service.initSkirmish(players ? [...players] : undefined, enemies ? [...enemies] : undefined);
      service.toggleAutoBattle();
      for (let i = 0; i < 2000 && service.battleStatus() === 'active'; i++)
        vi.advanceTimersByTime(600);
      expect(service.battleStatus()).not.toBe('active');
      const logs = service.combatLogs();
      const round = service.roundNumber();
      vi.advanceTimersByTime(10000);
      expect(service.combatLogs()).toEqual(logs);
      expect(service.roundNumber()).toBe(round);
    },
  );
});
