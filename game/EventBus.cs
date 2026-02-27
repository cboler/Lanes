using System;
using Godot;
using Lanes.Combat.Units;

namespace Lanes.Game;

/// <summary>
/// Typed, decoupled event bus (AutoLoad singleton).
///
/// Systems publish events here instead of holding direct references to
/// each other.  Subscribers register C# delegates which are garbage-collected
/// safely when the subscriber is freed.
///
/// Usage
/// -----
/// Subscribe:   EventBus.Instance.TurnStarted += OnTurnStarted;
/// Publish:     EventBus.Instance.EmitTurnStarted(unit);
/// Unsubscribe: EventBus.Instance.TurnStarted -= OnTurnStarted;
/// </summary>
public sealed partial class EventBus : Node
{
    /// <summary>Global singleton set on <c>_Ready</c>.</summary>
    public static EventBus Instance { get; private set; } = null!;

    public override void _Ready()
    {
        Instance = this;
    }

    // ── Combat ────────────────────────────────────────────────────────────

    /// <summary>Fired when a unit's turn begins.</summary>
    public event Action<UnitInstance>? TurnStarted;

    /// <summary>Fired when a unit's turn ends (gauge exhausted or manually ended).</summary>
    public event Action<UnitInstance>? TurnEnded;

    /// <summary>Fired when a unit changes lane.  Args: unit, fromLane, toLane.</summary>
    public event Action<UnitInstance, int, int>? UnitLaneChanged;

    /// <summary>Fired after damage is resolved.  Args: attacker, target, finalDamage.</summary>
    public event Action<UnitInstance, UnitInstance, int>? DamageDealt;

    /// <summary>Fired when a unit's HP reaches zero.</summary>
    public event Action<UnitInstance>? UnitDefeated;

    /// <summary>Fired when the battle concludes.  <c>true</c> = player won.</summary>
    public event Action<bool>? BattleEnded;

    // ── Action gauge ──────────────────────────────────────────────────────

    /// <summary>Fired whenever a unit spends action-gauge points.  Args: unit, remaining.</summary>
    public event Action<UnitInstance, float>? ActionGaugeChanged;

    /// <summary>Fired when a unit's action gauge drops to zero.</summary>
    public event Action<UnitInstance>? ActionGaugeExhausted;

    // ── Emit helpers ──────────────────────────────────────────────────────

    public void EmitTurnStarted(UnitInstance unit)               => TurnStarted?.Invoke(unit);
    public void EmitTurnEnded(UnitInstance unit)                 => TurnEnded?.Invoke(unit);
    public void EmitUnitLaneChanged(UnitInstance u, int f, int t) => UnitLaneChanged?.Invoke(u, f, t);
    public void EmitDamageDealt(UnitInstance a, UnitInstance t, int d) => DamageDealt?.Invoke(a, t, d);
    public void EmitUnitDefeated(UnitInstance unit)              => UnitDefeated?.Invoke(unit);
    public void EmitBattleEnded(bool playerWon)                  => BattleEnded?.Invoke(playerWon);
    public void EmitActionGaugeChanged(UnitInstance u, float r)  => ActionGaugeChanged?.Invoke(u, r);
    public void EmitActionGaugeExhausted(UnitInstance unit)      => ActionGaugeExhausted?.Invoke(unit);
}
