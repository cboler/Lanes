import { UnitInstance } from '../models/unit-instance.model';

export const DEFAULT_LANE_SWITCH_COST = 15;
export const MIN_LANE = 0;
export const MAX_LANE = 2;

/**
 * Handles lane switching mechanics and action gauge budgeting.
 */
export class LaneSwitcher {
  public static trySwitchLane(
    unit: UnitInstance,
    targetLane: number,
    costPerLane: number = DEFAULT_LANE_SWITCH_COST,
  ): boolean {
    if (targetLane < MIN_LANE || targetLane > MAX_LANE) {
      return false;
    }
    if (targetLane === unit.lane) {
      return false;
    }

    const distance = Math.abs(targetLane - unit.lane);
    const totalCost = costPerLane * distance;

    if (!unit.actionGauge.trySpend(totalCost)) {
      return false;
    }

    unit.lane = targetLane;
    return true;
  }
}
