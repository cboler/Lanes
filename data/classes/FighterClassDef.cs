using System.Collections.Generic;
using Lanes.Combat.Units;

namespace Lanes.Data.Classes;

/// <summary>
/// Fighter — frontline tank.
///
/// The Fighter wades into the thick of battle, soaking up hits that
/// would fell lighter units.  High HP and Defense make the Fighter the
/// party's anchor; moderate Attack lets them trade blows without being
/// purely passive.
///
/// Abilities
/// ---------
/// Shield Bash  — quick physical strike, cheap to cast, applies pressure.
/// Provoke      — taunts all enemies in the same lane; enemies are
///                encouraged to target the Fighter this round.
/// Bulwark      — defensive stance that temporarily raises the Fighter's
///                own Defense; costs no attack stat, purely protective.
///
/// Design notes
/// ------------
/// Stats deliberately lean physical; MagicAttack/MagicDefense are 0/0.
/// ThemeKey defaults to "fighter" so re-skins only need to supply new
/// visual assets under a different key.
/// </summary>
public static class FighterClassDef
{
    public static UnitClassDefinition Create(string? themeKey = null) =>
        new(themeKey)
        {
            Id          = "fighter",
            Name        = "Fighter",
            Description = "A heavily-armoured warrior who holds the front line and draws enemy fire.",
            Role        = UnitRole.Tank,
            BaseStats   = new UnitBaseStats(
                MaxHp:        180,
                Attack:        65,
                Defense:       50,
                Speed:         40,
                MagicAttack:    0,
                MagicDefense:  10,
                MeleeRange:     1),
            Abilities = new List<AbilityDefinition>
            {
                new(
                    Id:              "shield_bash",
                    Name:            "Shield Bash",
                    Description:     "Strike with the shield edge. Quick, low-cost, and reliable.",
                    ActionCost:      20,
                    DamageType:      DamageType.Physical,
                    PowerMultiplier: 0.9f,
                    Target:          AbilityTarget.SingleEnemy),

                new(
                    Id:              "provoke",
                    Name:            "Provoke",
                    Description:     "Bellow a war cry that draws all enemies in this lane toward the Fighter.",
                    ActionCost:      25,
                    DamageType:      DamageType.Physical,
                    PowerMultiplier: 0.5f,
                    Target:          AbilityTarget.SameLaneEnemies),

                new(
                    Id:              "bulwark",
                    Name:            "Bulwark",
                    Description:     "Raise the shield high. Temporarily boosts own Defense.",
                    ActionCost:      30,
                    DamageType:      DamageType.Physical,
                    PowerMultiplier: 0f,
                    Target:          AbilityTarget.SingleAlly),
            },
        };
}
