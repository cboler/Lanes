import { describe, expect, it } from 'vitest';
import { assistCandidates, assistGain, pursuitFor } from './assist';
import { UnitInstance } from '../models/unit-instance.model';
import { ARCHER_CLASS, CLERIC_CLASS, FIGHTER_CLASS, WITCH_CLASS } from '../models/unit-class.model';
import { StatusEffectInstance } from '../models/status-effect.model';
import { TargetEffect } from './combat-executor';

const effect = (over: Partial<TargetEffect>): TargetEffect => ({
  target: new UnitInstance(FIGHTER_CLASS, 'T', 'enemy'),
  amount: 0,
  guardAbsorbed: 0,
  isHealing: false,
  wasDefeated: false,
  isFriendlyFire: false,
  missed: false,
  ...over,
});

describe('assist gauge', () => {
  it('fills with half the damage dealt to enemies, plus a bonus per defeat', () => {
    expect(
      assistGain([
        effect({ amount: 40 }),
        effect({ amount: 21, wasDefeated: true }),
        effect({ amount: 30, isFriendlyFire: true }),
        effect({ amount: 50, isHealing: true }),
      ]),
    ).toBe(20 + 10 + 25);
  });

  it("plans an ally's pursuit: its basic attack at the preferred target, else the weakest", () => {
    const archer = new UnitInstance(ARCHER_CLASS, 'Archer', 'player', 1, 0.14);
    const near = new UnitInstance(FIGHTER_CLASS, 'Near', 'enemy', 1, 0.68);
    const far = new UnitInstance(FIGHTER_CLASS, 'Far', 'enemy', 1, 0.86);
    const units = [archer, near, far];
    // Quick Shot hits the closest enemy in the lane, whoever is preferred.
    expect(pursuitFor(archer, units, far.id)?.targets).toEqual([near]);
    expect(pursuitFor(archer, units)?.ability.id).toBe('quick_shot');
    const witch = new UnitInstance(WITCH_CLASS, 'Witch', 'player', 2, 0.14);
    expect(pursuitFor(witch, units)).toBeNull();
    archer.applyStatusEffect(new StatusEffectInstance('stun', 1));
    expect(pursuitFor(archer, units)).toBeNull();
  });

  it('offers every ally but the one acting, and only those who can reach someone', () => {
    const fighter = new UnitInstance(FIGHTER_CLASS, 'Fighter', 'player', 1, 0.32);
    const archer = new UnitInstance(ARCHER_CLASS, 'Archer', 'player', 1, 0.14);
    const cleric = new UnitInstance(CLERIC_CLASS, 'Cleric', 'player', 0, 0.14);
    const foe = new UnitInstance(FIGHTER_CLASS, 'Foe', 'enemy', 1, 0.68);
    const options = assistCandidates(fighter, [fighter, archer, cleric, foe]);
    // The cleric's Holy Smite is single-enemy in lane I, where no enemy stands.
    expect(options.map((o) => o.ally)).toEqual([archer]);
  });
});
