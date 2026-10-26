import { describe, it, expect } from 'vitest';
import { TurnManager } from './turn-manager';
import { UnitInstance } from '../models/unit-instance.model';
import { FIGHTER_CLASS, ARCHER_CLASS, WITCH_CLASS } from '../models/unit-class.model';

describe('TurnManager', () => {
  it('orders units by Speed descending', () => {
    // Archer speed = 75, Witch speed = 50, Fighter speed = 40
    const archer = new UnitInstance(ARCHER_CLASS, 'Archer', 'player');
    const witch = new UnitInstance(WITCH_CLASS, 'Witch', 'player');
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Fighter', 'player');

    const manager = new TurnManager();
    manager.setOrder([fighter, archer, witch]);

    expect(manager.order).toEqual([archer, witch, fighter]);
    expect(manager.current).toBe(archer);
    expect(manager.isRoundComplete).toBe(false);
  });

  it('advances through turns and marks round complete', () => {
    const archer = new UnitInstance(ARCHER_CLASS, 'Archer', 'player');
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Fighter', 'player');

    const manager = new TurnManager();
    manager.setOrder([archer, fighter]);

    expect(manager.current).toBe(archer);
    const next = manager.advance();
    expect(next).toBe(fighter);
    expect(manager.current).toBe(fighter);

    const end = manager.advance();
    expect(end).toBeNull();
    expect(manager.isRoundComplete).toBe(true);
  });

  it('skips dead units when advancing', () => {
    const archer = new UnitInstance(ARCHER_CLASS, 'Archer', 'player');
    const witch = new UnitInstance(WITCH_CLASS, 'Witch', 'player');
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Fighter', 'player');

    const manager = new TurnManager();
    manager.setOrder([archer, witch, fighter]);

    // Witch dies before her turn
    witch.takeDamage(witch.maxHp);
    expect(witch.isAlive).toBe(false);

    expect(manager.current).toBe(archer);
    const next = manager.advance();
    // Skips witch and goes directly to fighter
    expect(next).toBe(fighter);
  });

  it('alternates sides on a tie, and flips which side leads each tie and each round', () => {
    const mk = (cls: typeof ARCHER_CLASS, team: 'player' | 'enemy', n: number) =>
      new UnitInstance(cls, `${team} ${cls.name} ${n}`, team, n % 3, team === 'player' ? 0.2 : 0.8);
    const units = [
      mk(ARCHER_CLASS, 'player', 0),
      mk(ARCHER_CLASS, 'enemy', 0),
      mk(FIGHTER_CLASS, 'player', 1),
      mk(FIGHTER_CLASS, 'enemy', 1),
    ];
    const manager = new TurnManager();
    manager.setOrder(units);
    const teams = () => manager.order.map((u) => u.team);
    const first = teams();
    // The archers tie, then the fighters: the sides alternate, and the second tie is led
    // by the side that followed in the first.
    expect(first[0]).not.toBe(first[1]);
    expect(first[2]).toBe(first[1]);
    expect(first[3]).toBe(first[0]);
    expect(manager.order.slice(0, 2).every((u) => u.classDef === ARCHER_CLASS)).toBe(true);
    // The next round, the other side leads.
    manager.startNewRound(units);
    expect(teams()).toEqual(first.map((team) => (team === 'player' ? 'enemy' : 'player')));
    // The same line-up always gives the same order.
    const again = new TurnManager();
    again.setOrder(units);
    expect(again.order.map((u) => u.team)).toEqual(first);
  });

  it('gives each side the first tie about half the time across line-ups', () => {
    let player = 0;
    const lineUps = 400;
    for (let i = 0; i < lineUps; i++) {
      const manager = new TurnManager();
      manager.setOrder([
        new UnitInstance(FIGHTER_CLASS, `Ally ${i}`, 'player', i % 3, 0.32),
        new UnitInstance(FIGHTER_CLASS, `Foe ${i}`, 'enemy', (i + 1) % 3, 0.68),
      ]);
      if (manager.current!.team === 'player') player++;
    }
    expect(player / lineUps).toBeGreaterThan(0.4);
    expect(player / lineUps).toBeLessThan(0.6);
  });
});
