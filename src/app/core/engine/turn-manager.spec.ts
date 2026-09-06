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
});
