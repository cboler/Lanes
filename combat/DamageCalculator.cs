using System;
using Lanes.Combat.Units;

namespace Lanes.Combat;

/// <summary>
/// Stateless utility that resolves the numerical outcome of an ability use.
/// All formulae live here so they can be tweaked, tested, and balanced in
/// isolation from the rest of the combat system.
///
/// Formula (physical):
///   raw    = attacker.Attack * ability.PowerMultiplier
///   damage = max(1, raw - target.Defense)
///
/// Formula (magical):
///   raw    = attacker.MagicAttack * ability.PowerMultiplier
///   damage = max(1, raw - target.MagicDefense)
///
/// Formula (healing):
///   amount = attacker.MagicAttack * ability.PowerMultiplier  (min 1)
///   Healing bypasses defence; it restores HP instead.
/// </summary>
public static class DamageCalculator
{
    /// <summary>
    /// Calculates the amount of damage (or healing) produced by
    /// <paramref name="attacker"/> using <paramref name="ability"/>.
    /// The sign is always positive; call sites decide whether to subtract
    /// (damage) or add (healing) to the target's HP.
    /// </summary>
    public static int Calculate(UnitInstance attacker, AbilityDefinition ability)
    {
        if (attacker is null) throw new ArgumentNullException(nameof(attacker));
        if (ability is null)  throw new ArgumentNullException(nameof(ability));

        float raw = ability.DamageType switch
        {
            DamageType.Physical => attacker.Stats.Attack * ability.PowerMultiplier,
            DamageType.Magical  => attacker.Stats.MagicAttack * ability.PowerMultiplier,
            DamageType.Healing  => attacker.Stats.MagicAttack * ability.PowerMultiplier,
            _ => throw new ArgumentOutOfRangeException(nameof(ability), "Unknown DamageType.")
        };

        return Math.Max(1, (int)raw);
    }

    /// <summary>
    /// Calculates the net damage dealt to <paramref name="target"/> after
    /// defence reduction.  Returns 0 for healing abilities (no defence check).
    /// </summary>
    public static int CalculateWithDefense(UnitInstance attacker, UnitInstance target, AbilityDefinition ability)
    {
        if (target is null) throw new ArgumentNullException(nameof(target));
        if (ability.DamageType == DamageType.Healing)
            return 0;

        int raw = Calculate(attacker, ability);
        int defense = ability.DamageType switch
        {
            DamageType.Physical => target.Stats.Defense,
            DamageType.Magical  => target.Stats.MagicDefense,
            _ => 0
        };

        return Math.Max(1, raw - defense);
    }
}
