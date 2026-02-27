namespace Lanes.Combat.Units;

/// <summary>
/// Determines how an ability's power is computed and how it interacts
/// with the target's defences.
/// </summary>
public enum DamageType
{
    /// <summary>Scales with the user's Attack and is reduced by the target's Defense.</summary>
    Physical,

    /// <summary>Scales with the user's MagicAttack and is reduced by the target's MagicDefense.</summary>
    Magical,

    /// <summary>Restores HP instead of dealing damage; never reduced by defences.</summary>
    Healing,
}
