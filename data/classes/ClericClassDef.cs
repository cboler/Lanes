using System.Collections.Generic;
using Lanes.Combat.Units;

namespace Lanes.Data.Classes;

/// <summary>
/// Cleric — divine support caster.
///
/// The Cleric sustains the party through prolonged engagements.
/// Their healing magic outpaces the damage dealt by most enemies,
/// buying time for the front-liners to finish the fight.  Low physical
/// stats make the Cleric fragile; they must be protected.
///
/// Abilities
/// ---------
/// Mend         — restores HP of one ally in any lane (cross-lane reach).
/// Holy Smite   — magical strike on one enemy; bypasses physical armour.
/// Bless        — channels divine energy into all allies, healing the
///                whole party at once.
///
/// Design notes
/// ------------
/// MagicAttack is the primary scaling stat for both healing and smite.
/// MagicDefense is elevated to represent divine warding.
/// ThemeKey defaults to "cleric"; swap the key to re-theme as "shaman",
/// "medic", or any other flavour without touching combat logic.
/// </summary>
public static class ClericClassDef
{
    public static UnitClassDefinition Create(string? themeKey = null) =>
        new(themeKey)
        {
            Id          = "cleric",
            Name        = "Cleric",
            Description = "A holy healer who sustains allies and smites foes with divine magic.",
            Role        = UnitRole.Support,
            BaseStats   = new UnitBaseStats(
                MaxHp:        120,
                Attack:        30,
                Defense:       25,
                Speed:         55,
                MagicAttack:   70,
                MagicDefense:  45,
                MeleeRange:     1),
            Abilities = new List<AbilityDefinition>
            {
                new(
                    Id:              "mend",
                    Name:            "Mend",
                    Description:     "Channel healing light into one ally anywhere on the field.",
                    ActionCost:      25,
                    DamageType:      DamageType.Healing,
                    PowerMultiplier: 1.2f,
                    Target:          AbilityTarget.SingleAllyAnyLane,
                    CrossLane:       true),

                new(
                    Id:              "holy_smite",
                    Name:            "Holy Smite",
                    Description:     "A burst of divine energy that ignores physical armour.",
                    ActionCost:      30,
                    DamageType:      DamageType.Magical,
                    PowerMultiplier: 1.0f,
                    Target:          AbilityTarget.SingleEnemy),

                new(
                    Id:              "bless",
                    Name:            "Bless",
                    Description:     "Suffuse the entire party with divine grace, restoring HP for all.",
                    ActionCost:      50,
                    DamageType:      DamageType.Healing,
                    PowerMultiplier: 0.7f,
                    Target:          AbilityTarget.AllAllies,
                    CrossLane:       true),
            },
        };
}
