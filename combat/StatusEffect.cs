namespace Lanes.Combat;

/// <summary>
/// Types of status effects that can be applied to units during combat.
/// Grand Kingdom features a variety of effects that alter unit behaviour
/// and stats for a limited number of turns.
/// </summary>
public enum StatusEffectType
{
    /// <summary>Deals damage at the end of each of the affected unit's turns.</summary>
    Poison,

    /// <summary>The unit skips its next turn entirely.</summary>
    Stun,

    /// <summary>Increases the unit's physical Attack stat.</summary>
    AttackUp,

    /// <summary>Decreases the unit's physical Attack stat.</summary>
    AttackDown,

    /// <summary>Increases the unit's Defense stat.</summary>
    DefenseUp,

    /// <summary>Decreases the unit's Defense stat.</summary>
    DefenseDown,
}
