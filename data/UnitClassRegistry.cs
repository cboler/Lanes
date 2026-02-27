using System;
using System.Collections.Generic;
using System.Linq;
using Lanes.Combat.Units;
using Lanes.Data.Classes;

namespace Lanes.Data;

/// <summary>
/// Central registry of all unit classes available in the game.
///
/// Extensibility
/// -------------
/// To add a new class:
///   1. Create a static factory class in <c>data/classes/</c>.
///   2. Call <see cref="Register"/> from that class (or add the entry in
///      <see cref="BuildDefaults"/>).
///
/// Re-theming
/// ----------
/// Call <see cref="Register"/> with an existing <c>Id</c> but a different
/// <see cref="UnitClassDefinition.ThemeKey"/> to overlay a visual re-skin
/// without duplicating any combat logic.
/// </summary>
public sealed class UnitClassRegistry
{
    private readonly Dictionary<string, UnitClassDefinition> _classes = new();

    /// <summary>Singleton instance pre-populated with the default classes.</summary>
    public static readonly UnitClassRegistry Default = BuildDefaults();

    private static UnitClassRegistry BuildDefaults()
    {
        var reg = new UnitClassRegistry();
        reg.Register(FighterClassDef.Create());
        reg.Register(ClericClassDef.Create());
        reg.Register(ArcherClassDef.Create());
        return reg;
    }

    /// <summary>
    /// Registers <paramref name="classDef"/> by its <see cref="UnitClassDefinition.Id"/>.
    /// Replaces any previously registered definition with the same id.
    /// </summary>
    public void Register(UnitClassDefinition classDef)
    {
        if (classDef is null) throw new ArgumentNullException(nameof(classDef));
        _classes[classDef.Id] = classDef;
    }

    /// <summary>
    /// Retrieves the class definition for <paramref name="id"/>.
    /// </summary>
    /// <exception cref="KeyNotFoundException">When the id is not registered.</exception>
    public UnitClassDefinition Get(string id)
    {
        if (!_classes.TryGetValue(id, out var def))
            throw new KeyNotFoundException($"No unit class registered with id '{id}'.");
        return def;
    }

    /// <summary>Attempts to retrieve a class definition; returns <c>false</c> when not found.</summary>
    public bool TryGet(string id, out UnitClassDefinition? def) =>
        _classes.TryGetValue(id, out def);

    /// <summary>All registered class definitions in registration order.</summary>
    public IReadOnlyCollection<UnitClassDefinition> All => _classes.Values.ToList().AsReadOnly();

    /// <summary>Number of registered classes.</summary>
    public int Count => _classes.Count;
}
