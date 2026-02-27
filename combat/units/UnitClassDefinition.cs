using System.Collections.Generic;

namespace Lanes.Combat.Units;

/// <summary>
/// Immutable description of a playable unit class.
/// A class is pure data — it has no runtime state.  The engine uses
/// <see cref="UnitInstance"/> to track per-unit mutable state at runtime.
///
/// New classes can be introduced by:
///   1. Creating a static factory (see <c>data/classes/</c>) that returns a
///      <see cref="UnitClassDefinition"/> populated with the class's stats and abilities.
///   2. Registering it in <see cref="Lanes.Data.UnitClassRegistry"/>.
///
/// Re-skinning / re-theming:
///   The class definition carries only mechanical data.  Visual assets
///   (sprites, animations, VFX, colour palettes) are referenced by
///   <see cref="ThemeKey"/> and resolved at render time by the theme system,
///   so the same class can be displayed differently across campaigns.
/// </summary>
public sealed class UnitClassDefinition
{
    /// <summary>Unique identifier (snake_case, e.g. "fighter").</summary>
    public required string Id { get; init; }

    /// <summary>Localisation key or fallback display name.</summary>
    public required string Name { get; init; }

    /// <summary>Short description shown on the class-select screen.</summary>
    public required string Description { get; init; }

    /// <summary>Broad combat role used by AI and formation hints.</summary>
    public required UnitRole Role { get; init; }

    /// <summary>Baseline stats shared by every instance of this class.</summary>
    public required UnitBaseStats BaseStats { get; init; }

    /// <summary>Ordered list of abilities this class can use in combat.</summary>
    public required IReadOnlyList<AbilityDefinition> Abilities { get; init; }

    /// <summary>
    /// Opaque key passed to the theme/skin system to resolve visual assets.
    /// Defaults to <see cref="Id"/> when not set explicitly.
    /// </summary>
    public string ThemeKey => _themeKey ?? Id;
    private readonly string? _themeKey;

    /// <summary>
    /// Creates a definition.  The optional <paramref name="themeKey"/> allows
    /// the same mechanical class to be re-skinned under a different visual identity.
    /// </summary>
    public UnitClassDefinition(string? themeKey = null)
    {
        _themeKey = themeKey;
    }
}
