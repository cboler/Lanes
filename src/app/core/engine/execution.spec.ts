import { describe, it, expect } from 'vitest';
import {
  AIM_ZONES,
  CHAIN_WINDOW,
  aimGrade,
  aimSweepMs,
  aimZoneCenter,
  chainGrade,
  executionKind,
} from './execution';
import { UnitInstance } from '../models/unit-instance.model';
import {
  ARCHER_CLASS,
  CLERIC_CLASS,
  FIGHTER_CLASS,
  LANCER_CLASS,
  WITCH_CLASS,
} from '../models/unit-class.model';

const ability = (cls: typeof ARCHER_CLASS, id: string) => cls.abilities.find((a) => a.id === id)!;

describe('execution', () => {
  it('aims ranged and magic attacks, chains melee, and leaves heals and buffs alone', () => {
    const archer = new UnitInstance(ARCHER_CLASS, 'A', 'player', 0);
    const witch = new UnitInstance(WITCH_CLASS, 'W', 'player', 0);
    const lancer = new UnitInstance(LANCER_CLASS, 'L', 'player', 0);
    const fighter = new UnitInstance(FIGHTER_CLASS, 'F', 'player', 0);
    const cleric = new UnitInstance(CLERIC_CLASS, 'C', 'player', 0);
    expect(executionKind(archer, ability(ARCHER_CLASS, 'volley'))).toBe('aim');
    expect(executionKind(witch, ability(WITCH_CLASS, 'meteor'))).toBe('aim');
    expect(executionKind(cleric, ability(CLERIC_CLASS, 'holy_smite'))).toBe('aim');
    expect(executionKind(lancer, ability(LANCER_CLASS, 'piercing_lunge'))).toBe('combo');
    expect(executionKind(fighter, ability(FIGHTER_CLASS, 'shield_bash'))).toBe('combo');
    expect(executionKind(fighter, ability(FIGHTER_CLASS, 'bulwark'))).toBe('none');
    expect(executionKind(cleric, ability(CLERIC_CLASS, 'mend'))).toBe('none');
  });

  it('sweeps heavier skills faster', () => {
    expect(aimSweepMs(ability(ARCHER_CLASS, 'quick_shot'))).toBeGreaterThan(
      aimSweepMs(ability(WITCH_CLASS, 'meteor')),
    );
  });

  it('grades a press by its distance from the zone centre', () => {
    expect(aimGrade(0.6, 0.6)).toBe('critical');
    expect(aimGrade(0.6 + AIM_ZONES.critical + 0.01, 0.6)).toBe('hit');
    expect(aimGrade(0.6 - AIM_ZONES.hit - 0.01, 0.6)).toBe('graze');
    expect(aimGrade(0.6 + AIM_ZONES.graze + 0.01, 0.6)).toBe('miss');
    expect(aimGrade(0, 0.6)).toBe('miss');
  });

  it('places farther targets later on the track, within its ends', () => {
    const archer = new UnitInstance(ARCHER_CLASS, 'A', 'player', 0, 0.14);
    const near = new UnitInstance(FIGHTER_CLASS, 'N', 'enemy', 0, 0.3);
    const far = new UnitInstance(FIGHTER_CLASS, 'F', 'enemy', 2, 0.95);
    const nearCenter = aimZoneCenter(archer, [near]);
    const farCenter = aimZoneCenter(archer, [far]);
    expect(farCenter).toBeGreaterThan(nearCenter);
    expect(nearCenter).toBeGreaterThanOrEqual(0.3);
    expect(farCenter).toBeLessThanOrEqual(0.88);
  });

  it('ignores early chain presses, rewards the flash, and closes the window', () => {
    expect(chainGrade(CHAIN_WINDOW.open - 1)).toBe('early');
    expect(chainGrade(CHAIN_WINDOW.open + 1)).toBe('chain');
    expect(chainGrade(CHAIN_WINDOW.justFrom)).toBe('just');
    expect(chainGrade(CHAIN_WINDOW.justTo)).toBe('just');
    expect(chainGrade(CHAIN_WINDOW.justTo + 1)).toBe('chain');
    expect(chainGrade(CHAIN_WINDOW.close + 1)).toBeNull();
    // At 2x speed the window shrinks with the animation.
    expect(chainGrade(CHAIN_WINDOW.justFrom * 0.45, 0.45)).toBe('just');
    expect(chainGrade(CHAIN_WINDOW.close * 0.5, 0.45)).toBeNull();
  });

  it('slows the cursor with Precision Fire and widens the flash with Rhythm', () => {
    const shot = ability(ARCHER_CLASS, 'quick_shot');
    expect(aimSweepMs(shot, ['precision_fire'])).toBe(Math.round(aimSweepMs(shot) * 1.25));
    const early = CHAIN_WINDOW.justFrom - 30;
    expect(chainGrade(early)).toBe('chain');
    expect(chainGrade(early, 1, ['rhythm'])).toBe('just');
  });
});
