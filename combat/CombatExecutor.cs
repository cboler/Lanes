using System;
using System.Collections.Generic;
using System.Linq;
using Lanes.Combat.Units;

namespace Lanes.Combat;

/// <summary>
/// Resolves an ability use from attacker to targets, handling action-gauge
/// spending, damage/healing application, and defeat detection.
///
/// This is the central combat resolution engine that ties together the
/// <see cref="DamageCalculator"/>, <see cref="ActionGauge"/>, and
/// <see cref="UnitInstance"/> state mutations.
///
/// Grand Kingdom allows some AoE abilities to hit allies (friendly fire).
/// The <see cref="AbilityDefinition.FriendlyFire"/> flag controls this;
/// when set, allies in the target area also take damage.
/// </summary>
public static class CombatExecutor
{
    /// <summary>
    /// Executes <paramref name="ability"/> from <paramref name="attacker"/>
    /// against the supplied <paramref name="targets"/>.
    /// </summary>
    /// <remarks>
    /// Callers are responsible for selecting valid targets based on
    /// <see cref="AbilityTarget"/> rules.  This method trusts the target list,
    /// spending gauge and applying damage/healing to each target.
    /// </remarks>
    public static CombatResult Execute(
        UnitInstance attacker,
        AbilityDefinition ability,
        IReadOnlyList<UnitInstance> targets)
    {
        if (attacker is null) throw new ArgumentNullException(nameof(attacker));
        if (ability is null) throw new ArgumentNullException(nameof(ability));
        if (targets is null) throw new ArgumentNullException(nameof(targets));

        if (!attacker.IsAlive)
            return new CombatResult { Success = false, FailureReason = "Attacker is dead." };

        if (!attacker.ActionGauge.TrySpend(ability.ActionCost))
            return new CombatResult { Success = false, FailureReason = "Insufficient action gauge." };

        var effects = new List<CombatResult.TargetEffect>();

        foreach (var target in targets.Where(t => t.IsAlive))
        {
            if (ability.DamageType == DamageType.Healing)
            {
                int healAmount = DamageCalculator.Calculate(attacker, ability);
                target.Heal(healAmount);
                effects.Add(new CombatResult.TargetEffect(target, healAmount, IsHealing: true, WasDefeated: false));
            }
            else
            {
                int damage = DamageCalculator.CalculateWithDefense(attacker, target, ability);
                bool wasAlive = target.IsAlive;
                target.TakeDamage(damage);
                bool wasDefeated = wasAlive && !target.IsAlive;
                effects.Add(new CombatResult.TargetEffect(target, damage, IsHealing: false, WasDefeated: wasDefeated));
            }
        }

        return new CombatResult { Success = true, Effects = effects };
    }
}
