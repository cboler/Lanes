import { describe, it, expect, beforeEach } from 'vitest';
import { LaneSwitcher, DEFAULT_LANE_SWITCH_COST } from './lane-switcher';
import { UnitInstance } from '../models/unit-instance.model';
import { FIGHTER_CLASS } from '../models/unit-class.model';

describe('LaneSwitcher', () => {
  let unit: UnitInstance;

  beforeEach(() => {
    unit = new UnitInstance(FIGHTER_CLASS, 'Hero', 'player', 1, 0.2, 100);
  });

  it('switches lane when affordable and within bounds', () => {
    expect(unit.lane).toBe(1);
    const success = LaneSwitcher.trySwitchLane(unit, 0);
    expect(success).toBe(true);
    expect(unit.lane).toBe(0);
    expect(unit.actionGauge.current).toBe(100 - DEFAULT_LANE_SWITCH_COST);
  });

  it('charges double cost when moving two lanes', () => {
    const success = LaneSwitcher.trySwitchLane(unit, 0); // 1 -> 0 costs 15
    expect(success).toBe(true);
    const twoLaneSuccess = LaneSwitcher.trySwitchLane(unit, 2); // 0 -> 2 costs 30
    expect(twoLaneSuccess).toBe(true);
    expect(unit.lane).toBe(2);
    expect(unit.actionGauge.current).toBe(100 - 15 - 30);
  });

  it('rejects switching to the same lane', () => {
    expect(LaneSwitcher.trySwitchLane(unit, 1)).toBe(false);
    expect(unit.actionGauge.current).toBe(100);
  });

  it('rejects out-of-bounds lanes', () => {
    expect(LaneSwitcher.trySwitchLane(unit, -1)).toBe(false);
    expect(LaneSwitcher.trySwitchLane(unit, 3)).toBe(false);
    expect(unit.lane).toBe(1);
  });

  it('rejects lane switch if gauge is insufficient', () => {
    unit.actionGauge.exhaust();
    expect(LaneSwitcher.trySwitchLane(unit, 0)).toBe(false);
    expect(unit.lane).toBe(1);
  });
});
