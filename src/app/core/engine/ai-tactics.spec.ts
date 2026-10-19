import { describe, expect, it } from 'vitest';
import { chooseBuff, statusValue } from './ai-tactics';
import { UnitInstance } from '../models/unit-instance.model';
import {
  ARCHER_CLASS,
  CLERIC_CLASS,
  FIGHTER_CLASS,
  UnitClassDefinition,
} from '../models/unit-class.model';
import { StatusEffectInstance } from '../models/status-effect.model';

const veteran = (cls: UnitClassDefinition, team: 'player' | 'enemy', lane = 1, x = 0.3) =>
  new UnitInstance(cls, cls.name, team, lane, x, 100, undefined, undefined, {
    abilities: [...cls.abilities, ...cls.advancedAbilities],
  });
const skill = (cls: UnitClassDefinition, id: string) =>
  [...cls.abilities, ...cls.advancedAbilities].find((a) => a.id === id)!;

describe('AI tactics', () => {
  it('values a stun, poison or debuff on a target that survives, and nothing twice', () => {
    const foe = new UnitInstance(FIGHTER_CLASS, 'Foe', 'enemy', 1, 0.7);
    expect(statusValue(skill(FIGHTER_CLASS, 'shield_charge'), foe, 10)).toBe(40);
    expect(statusValue(skill(ARCHER_CLASS, 'poison_arrow'), foe, 10)).toBe(36);
    expect(statusValue(skill(FIGHTER_CLASS, 'crushing_blow'), foe, 10)).toBe(15);
    expect(statusValue(skill(FIGHTER_CLASS, 'shield_bash'), foe, 10)).toBe(0);
    // A finishing blow gains nothing from its status.
    expect(statusValue(skill(FIGHTER_CLASS, 'shield_charge'), foe, foe.currentHp)).toBe(0);
    foe.applyStatusEffect(new StatusEffectInstance('stun', 1));
    expect(statusValue(skill(FIGHTER_CLASS, 'shield_charge'), foe, 10)).toBe(0);
  });

  it('casts a party buff for two or more allies, a self buff for itself, and never instead of attacking', () => {
    const fighter = veteran(FIGHTER_CLASS, 'player');
    const cleric = new UnitInstance(CLERIC_CLASS, 'Ally', 'player', 0, 0.2);
    const foe = new UnitInstance(FIGHTER_CLASS, 'Foe', 'enemy', 1, 0.7);
    const units = [fighter, cleric, foe];
    // Bulwark comes first in the list and needs only the caster.
    expect(chooseBuff(fighter, units)?.id).toBe('bulwark');
    fighter.applyStatusEffect(new StatusEffectInstance('defense-up', 2, 25));
    expect(chooseBuff(fighter, units)?.id).toBe('rally');
    cleric.applyStatusEffect(new StatusEffectInstance('attack-up', 2, 15));
    expect(chooseBuff(fighter, units)).toBeNull();

    const tired = veteran(FIGHTER_CLASS, 'player');
    tired.actionGauge.trySpend(60);
    // 40 AP left: not enough for Bulwark (30) and the cheapest attack (20).
    expect(chooseBuff(tired, [tired, foe])).toBeNull();
  });
});
