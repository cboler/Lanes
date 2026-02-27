using System;
using Lanes.Combat.Units;

namespace Lanes.Combat;

/// <summary>
/// Handles the lane-switching mechanic that is core to Grand Kingdom's
/// tactical positioning.  Switching lanes costs action-gauge points, so
/// units must budget movement against attacks within a single turn.
/// </summary>
public static class LaneSwitcher
{
    /// <summary>Default action-gauge cost to switch one lane.</summary>
    public const float DefaultLaneSwitchCost = 15f;

    /// <summary>Minimum lane index (top).</summary>
    public const int MinLane = 0;

    /// <summary>Maximum lane index (bottom).</summary>
    public const int MaxLane = 2;

    /// <summary>
    /// Attempts to move <paramref name="unit"/> to <paramref name="targetLane"/>.
    /// The move succeeds only if the target lane is valid (0–2), is different
    /// from the current lane, and the unit can afford the gauge cost.
    /// </summary>
    /// <param name="unit">The unit attempting to switch lanes.</param>
    /// <param name="targetLane">Desired lane (0 = top, 1 = middle, 2 = bottom).</param>
    /// <param name="costPerLane">Gauge cost per lane moved; defaults to <see cref="DefaultLaneSwitchCost"/>.</param>
    /// <returns><c>true</c> if the lane switch was successful.</returns>
    public static bool TrySwitchLane(UnitInstance unit, int targetLane, float costPerLane = DefaultLaneSwitchCost)
    {
        if (unit is null) throw new ArgumentNullException(nameof(unit));
        if (targetLane < MinLane || targetLane > MaxLane)
            return false;
        if (targetLane == unit.Lane)
            return false;

        int laneDistance = Math.Abs(targetLane - unit.Lane);
        float totalCost = costPerLane * laneDistance;

        if (!unit.ActionGauge.TrySpend(totalCost))
            return false;

        unit.Lane = targetLane;
        return true;
    }
}
