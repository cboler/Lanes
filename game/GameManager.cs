using Godot;

namespace Lanes.Game;

/// <summary>
/// Global game-state singleton (AutoLoad).
///
/// Tracks the top-level phase of the application (MainMenu, Combat,
/// Overworld, etc.) and provides a single choke-point for scene transitions,
/// making re-theming and campaign-swapping straightforward.
/// </summary>
public sealed partial class GameManager : Node
{
    /// <summary>Global singleton set on <c>_Ready</c>.</summary>
    public static GameManager Instance { get; private set; } = null!;

    /// <summary>Broad phase the game is currently in.</summary>
    public enum Phase
    {
        /// <summary>Main menu / title screen.</summary>
        MainMenu,
        /// <summary>Lane-based tactical combat.</summary>
        Combat,
        /// <summary>Board-game overworld map.</summary>
        Overworld,
    }

    /// <summary>Currently active phase.</summary>
    public Phase CurrentPhase { get; private set; } = Phase.MainMenu;

    public override void _Ready()
    {
        Instance = this;
    }

    /// <summary>
    /// Transition to <paramref name="targetPhase"/> and load the associated scene.
    /// </summary>
    public void TransitionTo(Phase targetPhase)
    {
        CurrentPhase = targetPhase;
        string scenePath = targetPhase switch
        {
            Phase.MainMenu  => "res://scenes/main_menu.tscn",
            Phase.Combat    => "res://scenes/combat/battlefield.tscn",
            Phase.Overworld => "res://scenes/overworld/overworld_map.tscn",
            _               => "res://scenes/main_menu.tscn",
        };
        GetTree().ChangeSceneToFile(scenePath);
    }
}
