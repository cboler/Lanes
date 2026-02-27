using Godot;

namespace Lanes.Combat;

/// <summary>
/// A single horizontal lane on the battlefield.
/// Units move left and right within their assigned lane; switching lanes
/// moves a unit's <see cref="UnitInstance.Lane"/> index and repositions
/// the <see cref="UnitNode"/> between LaneNode siblings.
/// </summary>
public sealed partial class LaneNode : Node3D
{
    /// <summary>Horizontal half-width of the lane in world units.</summary>
    [Export] public float HalfWidth { get; set; } = 10f;
}
