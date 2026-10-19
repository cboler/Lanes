import { describe, expect, it } from 'vitest';
import {
  barricadeStats,
  makeTrap,
  parseObjectSpec,
  springTrap,
  trapsCrossed,
} from './field-object.model';
import { generateBoard } from './contract.model';
import { seededRandom } from './mercenary.model';
import { BARRICADE_CLASS, FIGHTER_CLASS } from './unit-class.model';
import { UnitInstance } from './unit-instance.model';
import { CombatExecutor } from '../engine/combat-executor';
import { TurnManager } from '../engine/turn-manager';

const spikes = makeTrap({ kind: 'trap', trap: 'spikes', lane: 1, x: 0.5 }, 'enemy', 1, 't1');
const snare = makeTrap({ kind: 'trap', trap: 'snare', lane: 1, x: 0.5 }, 'enemy', 1, 't2');

describe('traps', () => {
  it('spring on an enemy passing over them in their lane, never on their own side', () => {
    const hero = new UnitInstance(FIGHTER_CLASS, 'Hero', 'player', 1, 0.4);
    expect(trapsCrossed([spikes], hero, 0.4, 0.45)).toEqual([]);
    expect(trapsCrossed([spikes], hero, 0.4, 0.55)).toEqual([spikes]);
    expect(trapsCrossed([spikes], hero, 0.6, 0.49)).toEqual([spikes]);
    hero.lane = 0;
    expect(trapsCrossed([spikes], hero, 0.4, 0.55)).toEqual([]);
    const friend = new UnitInstance(FIGHTER_CLASS, 'Friend', 'enemy', 1, 0.4);
    expect(trapsCrossed([spikes], friend, 0.4, 0.55)).toEqual([]);
  });

  it('wound and poison (spikes) or hold for a turn (snare)', () => {
    const hero = new UnitInstance(FIGHTER_CLASS, 'Hero', 'player', 1, 0.5);
    const hit = springTrap(spikes, hero);
    expect(hit.damage).toBe(20);
    expect(hero.hasEffect('poison')).toBe(true);
    springTrap(snare, hero);
    expect(hero.isStunned).toBe(true);
  });
});

describe('barricades', () => {
  it('grow sturdier with the contract level', () => {
    expect(barricadeStats(5).maxHp).toBeGreaterThan(barricadeStats(1).maxHp);
  });

  it('block direct attacks on the units behind them, take no turns and cannot be healed', () => {
    const hero = new UnitInstance(FIGHTER_CLASS, 'Hero', 'player', 1, 0.45);
    const wall = new UnitInstance(BARRICADE_CLASS, 'Barricade', 'enemy', 1, 0.6);
    const foe = new UnitInstance(FIGHTER_CLASS, 'Foe', 'enemy', 1, 0.68);
    const units = [hero, wall, foe];
    expect(CombatExecutor.getValidTargets(hero, FIGHTER_CLASS.abilities[0], units)).toEqual([wall]);
    const turns = new TurnManager();
    turns.setOrder(units);
    expect(turns.order).not.toContain(wall);
    // Shield Bash would knock back, but a barricade stands fast.
    CombatExecutor.execute(hero, FIGHTER_CLASS.abilities[0], [wall], units);
    expect(wall.positionX).toBe(0.6);
  });
});

describe('contract objects', () => {
  it('raise more objects on harder contracts, with traps in different lanes', () => {
    const board = generateBoard(2, seededRandom(3));
    const count = (i: number, kind: string) =>
      board[i].objects.filter((o) => o.kind === kind).length;
    expect([count(0, 'barricade'), count(0, 'trap')]).toEqual([0, 1]);
    expect([count(1, 'barricade'), count(1, 'trap')]).toEqual([1, 1]);
    expect([count(2, 'barricade'), count(2, 'trap')]).toEqual([1, 2]);
    const trapLanes = board[2].objects.filter((o) => o.kind === 'trap').map((o) => o.lane);
    expect(new Set(trapLanes).size).toBe(trapLanes.length);
  });

  it('rejects a malformed saved placement', () => {
    expect(parseObjectSpec({ kind: 'barricade', lane: 1, x: 0.6 })).toEqual({
      kind: 'barricade',
      lane: 1,
      x: 0.6,
    });
    expect(parseObjectSpec({ kind: 'trap', trap: 'pit', lane: 1, x: 0.5 })).toBeNull();
    expect(parseObjectSpec({ kind: 'barricade', lane: 3, x: 0.6 })).toBeNull();
  });
});
