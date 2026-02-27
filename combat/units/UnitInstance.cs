using System;
using System.Collections.Generic;
using System.Linq;

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

    // ── Status effects ───────────────────────────────────────────────────

    private readonly List<StatusEffectInstance> _statusEffects = new();

    /// <summary>Active status effects on this unit.</summary>
    public IReadOnlyList<StatusEffectInstance> StatusEffects => _statusEffects.AsReadOnly();

    /// <summary>Returns <c>true</c> if the unit has at least one effect of <paramref name="type"/>.</summary>
    public bool HasEffect(StatusEffectType type) =>
        _statusEffects.Any(e => e.Type == type && !e.IsExpired);

    /// <summary>Convenience: <c>true</c> when the unit is stunned and should skip its turn.</summary>
    public bool IsStunned => HasEffect(StatusEffectType.Stun);

    /// <summary>
    /// Sum of all active stat modifiers for the given <paramref name="type"/>.
    /// Returns a signed value (positive for buffs, negative for debuffs).
    /// </summary>
    public int GetStatModifier(StatusEffectType type) =>
        type switch
        {
            StatusEffectType.AttackUp    =>  _statusEffects.Where(e => e.Type == type && !e.IsExpired).Sum(e => e.Potency),
            StatusEffectType.AttackDown  => -_statusEffects.Where(e => e.Type == type && !e.IsExpired).Sum(e => e.Potency),
            StatusEffectType.DefenseUp   =>  _statusEffects.Where(e => e.Type == type && !e.IsExpired).Sum(e => e.Potency),
            StatusEffectType.DefenseDown => -_statusEffects.Where(e => e.Type == type && !e.IsExpired).Sum(e => e.Potency),
            _ => 0
        };

    /// <summary>Effective Attack stat including active buffs/debuffs.</summary>
    public int EffectiveAttack => Math.Max(0,
        Stats.Attack
        + GetStatModifier(StatusEffectType.AttackUp)
        + GetStatModifier(StatusEffectType.AttackDown));

    /// <summary>Effective Defense stat including active buffs/debuffs.</summary>
    public int EffectiveDefense => Math.Max(0,
        Stats.Defense
        + GetStatModifier(StatusEffectType.DefenseUp)
        + GetStatModifier(StatusEffectType.DefenseDown));

    /// <summary>Applies a new status effect to this unit.</summary>
    public void ApplyStatusEffect(StatusEffectInstance effect)
    {
        if (effect is null) throw new ArgumentNullException(nameof(effect));
        _statusEffects.Add(effect);
    }

    /// <summary>
    /// Ticks all status effects (decrement duration), applies poison damage,
    /// and removes expired effects.  Call at end of the unit's turn.
    /// </summary>
    /// <returns>Total poison damage dealt this tick.</returns>
    public int TickStatusEffects()
    {
        int poisonDamage = 0;
        foreach (var effect in _statusEffects)
        {
            if (effect.Type == StatusEffectType.Poison && !effect.IsExpired)
                poisonDamage += effect.Potency;
            effect.Tick();
        }

        if (poisonDamage > 0)
            TakeDamage(poisonDamage);

        _statusEffects.RemoveAll(e => e.IsExpired);
        return poisonDamage;
    }

    /// <summary>Removes all status effects.</summary>
    public void ClearStatusEffects() => _statusEffects.Clear();

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
    /// Resets HP to <see cref="MaxHp"/>, refreshes the action gauge,
    /// and clears all status effects.  Use when starting a new battle.
    /// </summary>
    public void ResetForBattle()
    {
        CurrentHp = MaxHp;
        ActionGauge.Reset();
        ClearStatusEffects();
    }
}
