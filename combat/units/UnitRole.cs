namespace Lanes.Combat.Units;

/// <summary>
/// Broad role that a unit class fills in combat.
/// Used to guide AI targeting and formation suggestions.
/// </summary>
public enum UnitRole
{
    /// <summary>Frontline melee unit that absorbs damage.</summary>
    Tank,

    /// <summary>Close-range attacker optimised for single-target damage.</summary>
    Melee,

    /// <summary>Long-range attacker who attacks from the back row.</summary>
    Ranged,

    /// <summary>Support unit that heals allies or buffs the party.</summary>
    Support,
}
