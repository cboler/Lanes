using System.Collections.Generic;
using Lanes.Combat.Units;

namespace Lanes.Data.Classes;

/// <summary>
/// Witch — devastating area-of-effect magic caster.
///
/// The Witch brings powerful magic that can devastate clusters of enemies
/// across lanes.  Grand Kingdom's Witch archetype excels at controlling
/// the battlefield through wide-area spells, but is fragile and slow.
///
/// Abilities
/// ---------
/// Fire Bolt    — single-target magical attack; cheap and reliable poke.
/// Inferno      — engulfs all enemies in the same lane with flame; strong
///                AoE within a single lane.
/// Meteor       — drops a massive spell across the entire battlefield,
///                hitting all enemies regardless of lane.  Carries a
///                friendly-fire risk — allies in the blast zone take damage.
///
/// Design notes
/// ------------
/// Highest MagicAttack in the roster; lowest HP and Defense.
/// The Meteor ability has FriendlyFire = true, reflecting Grand Kingdom's
/// positioning strategy where careless AoE can hurt your own party.
/// </summary>
public static class WitchClassDef
{
    public static UnitClassDefinition Create(string? themeKey = null) =>
        new(themeKey)
        {
            Id          = "witch",
            Name        = "Witch",
            Description = "A glass-cannon mage who rains devastating AoE magic across the battlefield.",
            Role        = UnitRole.Ranged,
            BaseStats   = new UnitBaseStats(
                MaxHp:        90,
                Attack:       15,
                Defense:      15,
                Speed:        50,
                MagicAttack:  85,
                MagicDefense: 40,
                MeleeRange:    1),
            Abilities = new List<AbilityDefinition>
            {
                new(
                    Id:              "fire_bolt",
                    Name:            "Fire Bolt",
                    Description:     "Hurl a bolt of flame at a single enemy.",
                    ActionCost:      20,
                    DamageType:      DamageType.Magical,
                    PowerMultiplier: 1.0f,
                    Target:          AbilityTarget.SingleEnemy),

                new(
                    Id:              "inferno",
                    Name:            "Inferno",
                    Description:     "Unleash a wave of fire across the entire lane.",
                    ActionCost:      35,
                    DamageType:      DamageType.Magical,
                    PowerMultiplier: 0.75f,
                    Target:          AbilityTarget.SameLaneEnemies),

                new(
                    Id:              "meteor",
                    Name:            "Meteor",
                    Description:     "Call down a meteor that strikes ALL units on the field. Beware — allies are not spared.",
                    ActionCost:      55,
                    DamageType:      DamageType.Magical,
                    PowerMultiplier: 1.4f,
                    Target:          AbilityTarget.AllEnemies,
                    CrossLane:       true,
                    FriendlyFire:    true),
            },
        };
}
