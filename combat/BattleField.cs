using System.Collections.Generic;
using Godot;
using Lanes.Combat.Units;

namespace Lanes.Combat;

/// <summary>
/// Manages the three-lane battlefield at runtime.
///
/// Responsibilities
/// ----------------
/// • Owns references to the three <see cref="LaneNode"/> children.
/// • Spawns and positions <see cref="UnitNode"/> instances.
/// • Coordinates with <see cref="TurnManager"/> for round pacing.
/// • Raises events through <see cref="Lanes.Game.EventBus"/> so the UI
///   can stay in sync without a direct reference to the battlefield.
/// </summary>
public sealed partial class BattleField : Node3D
{
    /// <summary>Number of lanes on the battlefield.</summary>
    public const int LaneCount = 3;

    [Export] public NodePath? Lane0Path;
    [Export] public NodePath? Lane1Path;
    [Export] public NodePath? Lane2Path;

    private LaneNode[] _lanes = null!;
    private readonly TurnManager _turnManager = new();
    private readonly List<UnitInstance> _allUnits = new();

    public override void _Ready()
    {
        _lanes = new LaneNode[LaneCount];
        _lanes[0] = GetNodeOrNull<LaneNode>(Lane0Path ?? "Lane0") ?? CreateLane(0);
        _lanes[1] = GetNodeOrNull<LaneNode>(Lane1Path ?? "Lane1") ?? CreateLane(1);
        _lanes[2] = GetNodeOrNull<LaneNode>(Lane2Path ?? "Lane2") ?? CreateLane(2);

        if (_lanes[0] is null || _lanes[1] is null || _lanes[2] is null)
            GD.PushError("[BattleField] One or more lane nodes could not be found.");
    }

    private LaneNode CreateLane(int index)
    {
        var lane = new LaneNode { Name = $"Lane{index}" };
        AddChild(lane);
        return lane;
    }

    /// <summary>
    /// Registers units and builds the initial turn order.
    /// Call after all <see cref="UnitInstance"/> objects are constructed.
    /// </summary>
    public void BeginBattle(IEnumerable<UnitInstance> units)
    {
        _allUnits.Clear();
        _allUnits.AddRange(units);
        _turnManager.SetOrder(_allUnits);
    }
}
