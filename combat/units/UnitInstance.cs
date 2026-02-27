using System;

namespace Lanes.Combat.Units;

/// <summary>
/// Mutable runtime state for a single unit on the battlefield.
/// A <see cref="UnitInstance"/> is always backed by an immutable
/// <see cref="UnitClassDefinition"/> that holds base stats and abilities.
///
/// The instance owns:
///   • current HP (modified by <see cref="TakeDamage"/> / <see cref="Heal"/>)
///   • lane position (0 = top, 1 = middle, 2 = bottom)
///   • horizontal position within the lane (continuous float)
///   • action gauge for the current turn
/// </summary>
public sealed class UnitInstance
{
    /// <summary>Class definition (immutable base stats and abilities).</summary>
    public UnitClassDefinition ClassDef { get; }

    /// <summary>Display name for this specific unit (e.g. "Sir Roland").</summary>
    public string Name { get; set; }

    /// <summary>Convenience accessor for the class's base stats.</summary>
    public UnitBaseStats Stats => ClassDef.BaseStats;

    /// <summary>Current hit points.</summary>
    public int CurrentHp { get; private set; }

    /// <summary>Maximum hit points (derived from base stats).</summary>
    public int MaxHp => ClassDef.BaseStats.MaxHp;

    /// <summary><c>true</c> while the unit has at least 1 HP.</summary>
    public bool IsAlive => CurrentHp > 0;

    /// <summary>Lane index (0 = top row, 1 = middle row, 2 = bottom row).</summary>
    public int Lane { get; set; }

    /// <summary>Horizontal position within the lane (normalised 0–1 range).</summary>
    public float PositionX { get; set; }

    /// <summary>Action gauge that depletes as the unit moves and uses abilities.</summary>
    public ActionGauge ActionGauge { get; }

    /// <summary>Default action-gauge max when no override is supplied.</summary>
    private const float DefaultGaugeMax = 100f;

    /// <param name="classDef">The unit's class definition.</param>
    /// <param name="name">Unique display name for this unit.</param>
    /// <param name="lane">Starting lane (0–2).</param>
    /// <param name="positionX">Starting horizontal position (0–1).</param>
    /// <param name="gaugeMax">Action gauge maximum; defaults to 100.</param>
    public UnitInstance(
        UnitClassDefinition classDef,
        string name,
        int lane = 1,
        float positionX = 0f,
        float gaugeMax = DefaultGaugeMax)
    {
        ClassDef   = classDef ?? throw new ArgumentNullException(nameof(classDef));
        Name       = name     ?? throw new ArgumentNullException(nameof(name));
        Lane       = lane;
        PositionX  = positionX;
        CurrentHp  = classDef.BaseStats.MaxHp;
        ActionGauge = new ActionGauge(gaugeMax);
    }

    /// <summary>
    /// Reduces current HP by <paramref name="amount"/> (clamped to 0).
    /// </summary>
    public void TakeDamage(int amount)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount), "Damage must be non-negative.");
        CurrentHp = Math.Max(0, CurrentHp - amount);
    }

    /// <summary>
    /// Restores <paramref name="amount"/> HP, clamped to <see cref="MaxHp"/>.
    /// </summary>
    public void Heal(int amount)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount), "Heal amount must be non-negative.");
        CurrentHp = Math.Min(MaxHp, CurrentHp + amount);
    }

    /// <summary>
    /// Resets HP to <see cref="MaxHp"/> and refreshes the action gauge.
    /// Use when starting a new battle.
    /// </summary>
    public void ResetForBattle()
    {
        CurrentHp = MaxHp;
        ActionGauge.Reset();
    }
}
