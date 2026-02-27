namespace Lanes.Combat.Units;

/// <summary>
/// Defines which units an ability can target relative to the user's
/// current lane. Keeping this explicit makes it trivial to add new
/// targeting rules without touching the calculator.
/// </summary>
public enum AbilityTarget
{
    /// <summary>One enemy in the same lane.</summary>
    SingleEnemy,

    /// <summary>One ally in the same lane (or the user themselves).</summary>
    SingleAlly,

    /// <summary>All enemies in the same lane.</summary>
    SameLaneEnemies,

    /// <summary>One enemy in any lane (cross-lane snipe).</summary>
    SingleEnemyAnyLane,

    /// <summary>One ally in any lane.</summary>
    SingleAllyAnyLane,

    /// <summary>All enemies on the battlefield, regardless of lane.</summary>
    AllEnemies,

    /// <summary>All allies on the battlefield (including the caster).</summary>
    AllAllies,
}
