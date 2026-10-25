import { describe, expect, it } from 'vitest';
import {
  barricadeStats,
  makeTrap,
  parseObjectSpec,
  placementSpot,
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

  it('sets placed objects down ahead of their user, only where there is room', () => {
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Hero', 'player', 1, 0.3);
    const foe = new UnitInstance(FIGHTER_CLASS, 'Foe', 'enemy', 1, 0.7);
    expect(placementSpot(fighter, 'barricade', [fighter, foe], [])).toBe(0.4);
    expect(placementSpot(fighter, 'snare', [fighter, foe], [])).toBe(0.5);
    // The enemy places toward the player's side.
    expect(placementSpot(foe, 'barricade', [fighter, foe], [])).toBe(0.6);
    // Someone standing where the barricade would go, or in the way, blocks it.
    foe.positionX = 0.45;
    expect(placementSpot(fighter, 'barricade', [fighter, foe], [])).toBeNull();
    foe.positionX = 0.36;
    expect(placementSpot(fighter, 'barricade', [fighter, foe], [])).toBeNull();
    // A lane-mate behind does not.
    const friend = new UnitInstance(FIGHTER_CLASS, 'Friend', 'player', 1, 0.14);
    foe.positionX = 0.7;
    expect(placementSpot(fighter, 'barricade', [fighter, foe, friend], [])).toBe(0.4);
    // Traps may lie under anyone, but not on another trap or past the edge.
    const laid = makeTrap({ kind: 'trap', trap: 'snare', lane: 1, x: 0.5 }, 'player', 1, 'p1');
    expect(placementSpot(fighter, 'snare', [fighter], [laid])).toBeNull();
    fighter.positionX = 0.8;
    expect(placementSpot(fighter, 'snare', [fighter], [])).toBeNull();
  });
});

describe('siege engines', () => {
  it('can be fired by a unit of their side beside them in their lane', async () => {
    const { enginesBeside, engineStats, parseObjectSpec } = await import('./field-object.model');
    const { ENGINE_CLASSES } = await import('./unit-class.model');
    const ballista = new UnitInstance(ENGINE_CLASSES.ballista, 'Ballista', 'player', 1, 0.2);
    const crew = new UnitInstance(FIGHTER_CLASS, 'Crew', 'player', 1, 0.3);
    const foe = new UnitInstance(FIGHTER_CLASS, 'Foe', 'enemy', 1, 0.3);
    expect(enginesBeside(crew, [ballista, crew, foe])).toEqual([ballista]);
    expect(enginesBeside(foe, [ballista, crew, foe])).toEqual([]);
    crew.positionX = 0.4;
    expect(enginesBeside(crew, [ballista, crew])).toEqual([]);
    crew.positionX = 0.3;
    crew.lane = 2;
    expect(enginesBeside(crew, [ballista, crew])).toEqual([]);
    expect(engineStats('ballista', 5).attack).toBeGreaterThan(engineStats('ballista', 1).attack);
    expect(engineStats('sparkcoil', 3).attack).toBe(0);
    expect(parseObjectSpec({ kind: 'engine', engine: 'catapult', lane: 2, x: 0.8 })).toEqual({
      kind: 'engine',
      engine: 'catapult',
      lane: 2,
      x: 0.8,
      team: 'enemy',
    });
    expect(parseObjectSpec({ kind: 'engine', engine: 'trebuchet', lane: 2, x: 0.8 })).toBeNull();
  });

  it('strike with their own reach: a catapult splashes a lane, a sparkcoil only nearby', async () => {
    const { ENGINE_CLASSES } = await import('./unit-class.model');
    const catapult = new UnitInstance(ENGINE_CLASSES.catapult, 'Catapult', 'player', 0, 0.1);
    const a = new UnitInstance(FIGHTER_CLASS, 'A', 'enemy', 2, 0.7);
    const b = new UnitInstance(FIGHTER_CLASS, 'B', 'enemy', 2, 0.85);
    const c = new UnitInstance(FIGHTER_CLASS, 'C', 'enemy', 1, 0.7);
    const stone = ENGINE_CLASSES.catapult.abilities[0];
    const result = CombatExecutor.execute(
      catapult,
      stone,
      [a],
      [catapult, a, b, c],
      undefined,
      false,
    );
    expect(result.effects.map((e) => e.target.name).sort()).toEqual(['A', 'B']);
    const coil = new UnitInstance(ENGINE_CLASSES.sparkcoil, 'Coil', 'player', 1, 0.3);
    const shock = ENGINE_CLASSES.sparkcoil.abilities[0];
    c.positionX = 0.6;
    expect(CombatExecutor.getValidTargets(coil, shock, [coil, c]).map((u) => u.name)).toEqual([
      'C',
    ]);
    c.positionX = 0.9;
    expect(CombatExecutor.getValidTargets(coil, shock, [coil, c])).toEqual([]);
  });
});
