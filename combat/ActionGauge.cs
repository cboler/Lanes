using System;

namespace Lanes.Combat;

/// <summary>
/// Tracks and spends the action-gauge budget for a single unit's turn.
/// The gauge is a simple float counter; spending returns whether the
/// action was affordable so callers can decide whether to proceed.
/// </summary>
public sealed class ActionGauge
{
    /// <summary>Full gauge value at the start of every turn.</summary>
    public float Max { get; }

    /// <summary>Remaining gauge points this turn.</summary>
    public float Current { get; private set; }

    /// <summary><c>true</c> when no gauge remains (unit may not act further).</summary>
    public bool IsExhausted => Current <= 0f;

    /// <summary>Fraction of the gauge that remains (0–1).</summary>
    public float Fraction => Max > 0f ? Current / Max : 0f;

    /// <param name="max">Maximum gauge value; must be positive.</param>
    public ActionGauge(float max)
    {
        if (max <= 0f)
            throw new ArgumentOutOfRangeException(nameof(max), "Action gauge maximum must be positive.");
        Max = max;
        Current = max;
    }

    /// <summary>
    /// Attempts to spend <paramref name="cost"/> from the gauge.
    /// </summary>
    /// <returns>
    /// <c>true</c> if the cost was affordable and was deducted;
    /// <c>false</c> if the gauge does not have enough points (nothing is spent).
    /// </returns>
    public bool TrySpend(float cost)
    {
        if (cost < 0f)
            throw new ArgumentOutOfRangeException(nameof(cost), "Cost must be non-negative.");

        if (Current < cost)
            return false;

        Current -= cost;
        return true;
    }

    /// <summary>Forcibly sets the gauge to zero (end-of-turn expiry).</summary>
    public void Exhaust() => Current = 0f;

    /// <summary>Resets the gauge to its maximum (start of a new turn).</summary>
    public void Reset() => Current = Max;
}
