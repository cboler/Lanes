using System.Collections.Generic;
using Lanes.Combat.Units;

namespace Lanes.Combat;

/// <summary>
/// The outcome of executing a single ability against one or more targets.
/// </summary>
public sealed class CombatResult
{
    /// <summary>Whether the ability was successfully executed.</summary>
    public bool Success { get; init; }

    /// <summary>Individual effects applied to each target.</summary>
    public IReadOnlyList<TargetEffect> Effects { get; init; } = [];

    /// <summary>Reason for failure when <see cref="Success"/> is <c>false</c>.</summary>
    public string? FailureReason { get; init; }

    /// <summary>
    /// Describes the effect on a single target.
    /// </summary>
    /// <param name="Target">The unit that was affected.</param>
    /// <param name="Amount">Damage dealt or HP healed (always positive).</param>
    /// <param name="IsHealing"><c>true</c> if the effect restored HP.</param>
    /// <param name="WasDefeated"><c>true</c> if the target was killed by this effect.</param>
    public sealed record TargetEffect(
        UnitInstance Target,
        int Amount,
        bool IsHealing,
        bool WasDefeated);
}
