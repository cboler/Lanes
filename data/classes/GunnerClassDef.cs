using System.Collections.Generic;
using Lanes.Combat.Units;

namespace Lanes.Data.Classes;

/// <summary>
/// Gunner — ranged physical attacker with explosive firepower.
///
/// The Gunner is Grand Kingdom's gunpowder specialist, trading the
/// Archer's precision for raw stopping power and area suppression.
/// High Attack and decent Speed let the Gunner control lanes at range,
/// while Explosive Shot provides AoE with friendly-fire risk.
///
/// Abilities
/// ---------
/// Quick Fire   — snap shot at one enemy; cheap and fast.
/// Snipe        — powerful long-range shot targeting any lane; ignores
///                lane restrictions for devastating cross-lane picks.
/// Explosive Shot — launches an explosive round into the same lane,
///                  hitting every enemy.  FriendlyFire enabled — allies
///                  in the lane take splash damage.
///
/// Design notes
/// ------------
/// Attack is the primary stat.  Slightly lower Speed than the Archer
/// but higher raw Attack to differentiate the two ranged classes.
/// Explosive Shot has friendly fire to encourage careful positioning.
/// </summary>
public static class GunnerClassDef
{
    public static UnitClassDefinition Create(string? themeKey = null) =>
        new(themeKey)
        {
            Id          = "gunner",
            Name        = "Gunner",
            Description = "A ranged powerhouse whose explosive rounds can devastate a lane — friend and foe alike.",
            Role        = UnitRole.Ranged,
            BaseStats   = new UnitBaseStats(
                MaxHp:        100,
                Attack:        80,
                Defense:       20,
                Speed:         60,
                MagicAttack:    0,
                MagicDefense:  10,
                MeleeRange:     1),
            Abilities = new List<AbilityDefinition>
            {
                new(
                    Id:              "quick_fire",
                    Name:            "Quick Fire",
                    Description:     "A rapid shot at one enemy. Fast and reliable.",
                    ActionCost:      20,
                    DamageType:      DamageType.Physical,
                    PowerMultiplier: 0.9f,
                    Target:          AbilityTarget.SingleEnemy),

                new(
                    Id:              "snipe",
                    Name:            "Snipe",
                    Description:     "Take careful aim and fire a high-caliber round at any target on the field.",
                    ActionCost:      40,
                    DamageType:      DamageType.Physical,
                    PowerMultiplier: 1.5f,
                    Target:          AbilityTarget.SingleEnemyAnyLane,
                    CrossLane:       true),

                new(
                    Id:              "explosive_shot",
                    Name:            "Explosive Shot",
                    Description:     "Fire an explosive round that detonates across the lane. Allies beware!",
                    ActionCost:      35,
                    DamageType:      DamageType.Physical,
                    PowerMultiplier: 0.65f,
                    Target:          AbilityTarget.SameLaneEnemies,
                    FriendlyFire:    true),
            },
        };
}
