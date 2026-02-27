using Godot;
using Lanes.Combat.Units;

namespace Lanes.Combat;

/// <summary>
/// Godot scene node that wraps a <see cref="UnitInstance"/>.
///
/// Visual/physics behaviour lives here.  All combat logic (damage,
/// abilities, turn order) is handled by the pure-C# layer so it stays
/// testable without the Godot runtime.
/// </summary>
public sealed partial class UnitNode : CharacterBody3D
{
    /// <summary>Pure-C# instance backing this node.</summary>
    public UnitInstance? Instance { get; private set; }

    /// <summary>
    /// Bind this node to a <see cref="UnitInstance"/> after spawning.
    /// Must be called before the node is added to the scene tree.
    /// </summary>
    public void Bind(UnitInstance instance)
    {
        Instance = instance;
    }

    public override void _Ready()
    {
        if (Instance is null)
            GD.PushError($"[UnitNode] Node '{Name}' was added to the scene without calling Bind().");
    }
}
