namespace Lanes.Combat.Units;

/// <summary>
/// Immutable definition of a single combat ability.
/// All abilities are pure data; the <see cref="DamageCalculator"/>
/// and combat system consume them without needing class knowledge.
/// </summary>
/// <param name="Id">Unique identifier (snake_case, e.g. "shield_bash").</param>
/// <param name="Name">Display name shown in the UI.</param>
/// <param name="Description">Short flavour text / tooltip.</param>
/// <param name="ActionCost">Action-gauge points consumed on use.</param>
/// <param name="DamageType">Whether the ability deals physical, magical, or healing "damage".</param>
/// <param name="PowerMultiplier">
///     Coefficient applied to the relevant attack stat before defence reduction.
///     Values above 1.0 are power moves; below 1.0 are chip attacks.
/// </param>
/// <param name="Target">Which units can be selected as the target.</param>
/// <param name="CrossLane">
///     When <c>true</c> the ability can reach targets in adjacent lanes
///     without the user switching lanes first.
/// </param>
/// <param name="FriendlyFire">
///     When <c>true</c> the ability can hit allies caught in the area.
///     Core to Grand Kingdom's positioning strategy where careless AoE
///     can damage your own party.
/// </param>
public sealed record AbilityDefinition(
    string Id,
    string Name,
    string Description,
    int ActionCost,
    DamageType DamageType,
    float PowerMultiplier,
    AbilityTarget Target,
    bool CrossLane = false,
    bool FriendlyFire = false);
