using System;
using System.Collections.Generic;
using System.Linq;
using Lanes.Combat.Units;

namespace Lanes.Combat;

/// <summary>
/// Determines and advances the turn order for a group of units.
/// Turn order is resolved by descending Speed; ties are broken by the
/// unit's position in the roster (lower index acts first).
///
/// The manager does not mutate units — it only reads their stats.
/// </summary>
public sealed class TurnManager
{
    private readonly List<UnitInstance> _order = new();
    private int _currentIndex;

    /// <summary>
    /// Rebuilds the turn order from <paramref name="units"/>.
    /// Call at the start of each round after units may have died or had Speed changed.
    /// </summary>
    public void SetOrder(IEnumerable<UnitInstance> units)
    {
        if (units is null) throw new ArgumentNullException(nameof(units));

        _order.Clear();
        _order.AddRange(
            units
                .Where(u => u.IsAlive)
                .OrderByDescending(u => u.Stats.Speed));

        _currentIndex = 0;
    }

    /// <summary>Ordered snapshot of living units for this round (highest Speed first).</summary>
    public IReadOnlyList<UnitInstance> Order => _order.AsReadOnly();

    /// <summary>The unit whose turn it currently is, or <c>null</c> if the round is over.</summary>
    public UnitInstance? Current =>
        _currentIndex < _order.Count ? _order[_currentIndex] : null;

    /// <summary>
    /// Advances to the next living unit in turn order.
    /// Dead units are skipped automatically.
    /// </summary>
    /// <returns>
    /// The unit that is now acting, or <c>null</c> when the round is complete.
    /// </returns>
    public UnitInstance? Advance()
    {
        _currentIndex++;
        // Skip over units that died mid-round.
        while (_currentIndex < _order.Count && !_order[_currentIndex].IsAlive)
            _currentIndex++;

        return Current;
    }

    /// <summary><c>true</c> when all units in the current round have taken their turn.</summary>
    public bool IsRoundComplete => _currentIndex >= _order.Count;
}
