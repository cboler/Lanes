using System.Collections.Generic;
using Lanes.Combat.Units;

namespace Lanes.Data.Classes;

/// <summary>
/// Lancer — aggressive melee striker with cross-lane reach.
///
/// The Lancer is Grand Kingdom's signature close-range damage dealer.
/// Where the Fighter trades blows slowly, the Lancer hits hard and fast
/// with a long weapon that can pierce into adjacent lanes.  High Attack
/// and Speed make the Lancer a potent offensive threat, but low Defence
/// means they cannot absorb sustained fire.
///
/// Abilities
/// ---------
/// Thrust       — a quick, low-cost physical jab; the bread-and-butter
///                attack for gauge-efficient damage.
/// Piercing Lunge — a powerful cross-lane strike that reaches enemies in
///                  adjacent lanes without switching.
/// Whirlwind    — spin the lance in a circle, hitting all enemies in the
///                same lane with a sweeping attack.
///
/// Design notes
/// ------------
/// Highest physical Attack after the Archer, with notably higher MeleeRange
/// (2 vs 1) to represent the long polearm.  No magic stats.
/// </summary>
public static class LancerClassDef
{
    public static UnitClassDefinition Create(string? themeKey = null) =>
        new(themeKey)
        {
            Id          = "lancer",
            Name        = "Lancer",
            Description = "An aggressive melee striker whose long polearm reaches across lanes.",
            Role        = UnitRole.Melee,
            BaseStats   = new UnitBaseStats(
                MaxHp:        130,
                Attack:        80,
                Defense:       30,
                Speed:         65,
                MagicAttack:    0,
                MagicDefense:  10,
                MeleeRange:     2),
            Abilities = new List<AbilityDefinition>
            {
                new(
                    Id:              "thrust",
                    Name:            "Thrust",
                    Description:     "A quick jab with the lance tip. Cheap and reliable.",
                    ActionCost:      15,
                    DamageType:      DamageType.Physical,
                    PowerMultiplier: 0.85f,
                    Target:          AbilityTarget.SingleEnemy),

                new(
                    Id:              "piercing_lunge",
                    Name:            "Piercing Lunge",
                    Description:     "Lunge forward with devastating force, reaching into adjacent lanes.",
                    ActionCost:      30,
                    DamageType:      DamageType.Physical,
                    PowerMultiplier: 1.2f,
                    Target:          AbilityTarget.SingleEnemyAnyLane,
                    CrossLane:       true),

                new(
                    Id:              "whirlwind",
                    Name:            "Whirlwind",
                    Description:     "Spin the lance in a wide arc, striking every enemy in this lane.",
                    ActionCost:      40,
                    DamageType:      DamageType.Physical,
                    PowerMultiplier: 0.7f,
                    Target:          AbilityTarget.SameLaneEnemies),
            },
        };
}
