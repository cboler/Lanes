using System.Collections.Generic;
using Lanes.Combat.Units;

namespace Lanes.Data.Classes;

/// <summary>
/// Archer — nimble ranged attacker.
///
/// The Archer excels at picking off high-value targets from a distance,
/// often before those targets can close to melee.  High Speed means the
/// Archer typically acts first, and their cross-lane reach turns lane
/// positioning from a puzzle to a weapon.
///
/// Abilities
/// ---------
/// Quick Shot   — rapid single-target arrow; cheap and reliable.
/// Piercing Arrow — powerful shot that flies across lanes to hit any foe.
/// Volley       — rains arrows on all enemies in the same lane; trades
///                single-target power for crowd coverage.
///
/// Design notes
/// ------------
/// Attack is the primary offensive stat; no MagicAttack.
/// High Speed means the Archer usually has initiative.
/// ThemeKey defaults to "archer"; swap to "ranger", "hunter", or
/// "gunner" to re-theme without touching combat code.
/// </summary>
public static class ArcherClassDef
{
    public static UnitClassDefinition Create(string? themeKey = null) =>
        new(themeKey)
        {
            Id          = "archer",
            Name        = "Archer",
            Description = "A swift ranged fighter who picks off targets across any lane with deadly precision.",
            Role        = UnitRole.Ranged,
            BaseStats   = new UnitBaseStats(
                MaxHp:        110,
                Attack:        75,
                Defense:       20,
                Speed:         75,
                MagicAttack:    0,
                MagicDefense:  15,
                MeleeRange:     1),
            Abilities = new List<AbilityDefinition>
            {
                new(
                    Id:              "quick_shot",
                    Name:            "Quick Shot",
                    Description:     "Loose an arrow at one enemy. Fast and reliable.",
                    ActionCost:      20,
                    DamageType:      DamageType.Physical,
                    PowerMultiplier: 0.85f,
                    Target:          AbilityTarget.SingleEnemy),

                new(
                    Id:              "piercing_arrow",
                    Name:            "Piercing Arrow",
                    Description:     "A powerful shot that crosses lanes to reach any target on the field.",
                    ActionCost:      35,
                    DamageType:      DamageType.Physical,
                    PowerMultiplier: 1.3f,
                    Target:          AbilityTarget.SingleEnemyAnyLane,
                    CrossLane:       true),

                new(
                    Id:              "volley",
                    Name:            "Volley",
                    Description:     "Spray arrows across one lane, hitting every enemy within.",
                    ActionCost:      45,
                    DamageType:      DamageType.Physical,
                    PowerMultiplier: 0.6f,
                    Target:          AbilityTarget.SameLaneEnemies),
            },
        };
}
