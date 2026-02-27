using System;

namespace Lanes.Combat;

/// <summary>
/// A single active status effect on a unit.
/// Tracks the type, remaining duration, and potency.
///
/// Potency meaning varies by type:
///   Poison     — damage per tick
///   Stun       — unused (any positive value means stunned)
///   AttackUp   — flat bonus to Attack
///   AttackDown — flat penalty to Attack
///   DefenseUp  — flat bonus to Defense
///   DefenseDown— flat penalty to Defense
/// </summary>
public sealed class StatusEffectInstance
{
    /// <summary>The kind of effect.</summary>
    public StatusEffectType Type { get; }

    /// <summary>Number of turns remaining (decremented at end of turn).</summary>
    public int RemainingTurns { get; private set; }

    /// <summary>
    /// Strength of the effect.  Interpretation depends on <see cref="Type"/>.
    /// </summary>
    public int Potency { get; }

    /// <summary><c>true</c> when the effect has expired.</summary>
    public bool IsExpired => RemainingTurns <= 0;

    /// <param name="type">Kind of effect.</param>
    /// <param name="remainingTurns">How many turns the effect lasts; must be positive.</param>
    /// <param name="potency">Strength of the effect; must be positive.</param>
    public StatusEffectInstance(StatusEffectType type, int remainingTurns, int potency)
    {
        if (remainingTurns <= 0)
            throw new ArgumentOutOfRangeException(nameof(remainingTurns), "Duration must be positive.");
        if (potency <= 0)
            throw new ArgumentOutOfRangeException(nameof(potency), "Potency must be positive.");

        Type = type;
        RemainingTurns = remainingTurns;
        Potency = potency;
    }

    /// <summary>Decrements the remaining duration by one turn.</summary>
    public void Tick() => RemainingTurns = Math.Max(0, RemainingTurns - 1);
}
