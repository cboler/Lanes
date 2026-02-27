namespace Lanes.Combat.Units;

/// <summary>
/// Immutable baseline stats that define a unit class's combat profile.
/// Actual in-combat values may be modified by equipment or status effects
/// (store modifiers separately; do not mutate this record).
/// </summary>
/// <param name="MaxHp">Starting and maximum hit-point pool.</param>
/// <param name="Attack">Physical offensive power.</param>
/// <param name="Defense">Reduction applied to incoming physical damage.</param>
/// <param name="Speed">Determines turn order; higher acts first.</param>
/// <param name="MagicAttack">Magical offensive power (default 0 for non-casters).</param>
/// <param name="MagicDefense">Reduction applied to incoming magical damage (default 0).</param>
/// <param name="MeleeRange">
///     Maximum horizontal distance (in lane units) for an unarmed melee strike.
///     Ranged units use abilities rather than this value.
/// </param>
public sealed record UnitBaseStats(
    int MaxHp,
    int Attack,
    int Defense,
    int Speed,
    int MagicAttack = 0,
    int MagicDefense = 0,
    int MeleeRange = 1);
