import { UnitInstance } from '../models/unit-instance.model';

export const DEFAULT_LANE_SWITCH_COST = 15;
export const MIN_LANE = 0;
export const MAX_LANE = 2;

/**
 * Handles lane switching using the unit's Move Gauge.
 */
export class LaneSwitcher {
  public static trySwitchLane(
    unit: UnitInstance,
    targetLane: number,
    costPerLane: number = DEFAULT_LANE_SWITCH_COST,
  ): boolean {
    if (
      !Number.isInteger(targetLane) ||
      targetLane < MIN_LANE ||
      targetLane > MAX_LANE ||
      !Number.isInteger(unit.lane) ||
      unit.lane < MIN_LANE ||
      unit.lane > MAX_LANE ||
      !Number.isFinite(costPerLane) ||
      costPerLane < 0
    ) {
      return false;
    }
    if (targetLane === unit.lane) {
      return false;
    }

    const distance = Math.abs(targetLane - unit.lane);
    const totalCost = costPerLane * distance;

    if (!unit.moveGauge.trySpend(totalCost)) {
      return false;
    }

    unit.lane = targetLane;
    return true;
  }
}
