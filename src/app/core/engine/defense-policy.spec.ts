import { describe, expect, it } from 'vitest';
import { ARCHER_CLASS, CLERIC_CLASS, FIGHTER_CLASS } from '../models/unit-class.model';
import { UnitInstance } from '../models/unit-instance.model';
import { chooseDefenseTarget } from './defense-policy';

describe('defense targeting', () => {
  it('chooses legal targets by HP percentage, distance, leader, and lane with stable ties', () => {
    const defender = new UnitInstance(ARCHER_CLASS, 'Defender', 'enemy', 1, 0.8);
    const leader = new UnitInstance(FIGHTER_CLASS, 'Leader', 'player', 0, 0.2);
    const closest = new UnitInstance(FIGHTER_CLASS, 'Closest', 'player', 1, 0.5);
    const weakest = new UnitInstance(ARCHER_CLASS, 'Weakest', 'player', 2, 0.2);
    leader.takeDamage(90); // 50% remaining
    weakest.takeDamage(80); // under 30% remaining
    const ability = ARCHER_CLASS.abilities[1]; // cross-lane Piercing Arrow
    const units = [defender, leader, closest, weakest];
    expect(chooseDefenseTarget(defender, ability, units, 'lowest-hp')).toBe(weakest);
    expect(chooseDefenseTarget(defender, ability, units, 'closest')).toBe(closest);
    expect(chooseDefenseTarget(defender, ability, units, 'leader')).toBe(leader);
    expect(chooseDefenseTarget(defender, ability, units, 'front-lane')).toBe(leader);
    expect(chooseDefenseTarget(defender, ARCHER_CLASS.abilities[0], units, 'leader')).toBe(closest);
  });

  it('does not spend a heal on full health and picks the most wounded legal ally', () => {
    const healer = new UnitInstance(CLERIC_CLASS, 'Healer', 'enemy', 1);
    const ally = new UnitInstance(FIGHTER_CLASS, 'Ally', 'enemy', 0);
    const units = [healer, ally];
    expect(chooseDefenseTarget(healer, CLERIC_CLASS.abilities[0], units, 'leader')).toBeNull();
    ally.takeDamage(50);
    expect(chooseDefenseTarget(healer, CLERIC_CLASS.abilities[0], units, 'closest')).toBe(ally);
  });

  it('uses the saved priority when more than one ally needs healing', () => {
    const healer = new UnitInstance(CLERIC_CLASS, 'Healer', 'enemy', 1);
    const leader = new UnitInstance(FIGHTER_CLASS, 'Leader', 'enemy', 0);
    const other = new UnitInstance(FIGHTER_CLASS, 'Other', 'enemy', 1);
    leader.takeDamage(30);
    other.takeDamage(100);
    const units = [leader, healer, other];
    const mend = CLERIC_CLASS.abilities[0];
    expect(chooseDefenseTarget(healer, mend, units, 'lowest-hp')).toBe(other);
    expect(chooseDefenseTarget(healer, mend, units, 'leader')).toBe(leader);
    expect(chooseDefenseTarget(healer, mend, units, 'closest')).toBe(other);
  });
});
