using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using Lanes.Combat;
using Lanes.Combat.Units;

namespace Lanes.Tests;

[TestFixture]
public sealed class TurnManagerTests
{
    private static UnitInstance MakeUnit(string name, int speed, int hp = 100)
    {
        var classDef = new UnitClassDefinition
        {
            Id          = name,
            Name        = name,
            Description = "",
            Role        = UnitRole.Melee,
            BaseStats   = new UnitBaseStats(MaxHp: hp, Attack: 50, Defense: 20, Speed: speed),
            Abilities   = new List<AbilityDefinition>(),
        };
        return new UnitInstance(classDef, name);
    }

    [Test]
    public void SetOrder_SortsByDescendingSpeed()
    {
        var slow   = MakeUnit("Slow",   speed: 20);
        var medium = MakeUnit("Medium", speed: 50);
        var fast   = MakeUnit("Fast",   speed: 80);

        var tm = new TurnManager();
        tm.SetOrder(new[] { slow, medium, fast });

        var names = tm.Order.Select(u => u.Name).ToList();
        Assert.That(names, Is.EqualTo(new[] { "Fast", "Medium", "Slow" }));
    }

    [Test]
    public void Current_InitiallyFirstUnit()
    {
        var fast = MakeUnit("Fast", speed: 80);
        var slow = MakeUnit("Slow", speed: 20);
        var tm   = new TurnManager();
        tm.SetOrder(new[] { slow, fast });

        Assert.That(tm.Current, Is.SameAs(fast));
    }

    [Test]
    public void Advance_MovesToNextUnit()
    {
        var fast = MakeUnit("Fast", speed: 80);
        var slow = MakeUnit("Slow", speed: 20);
        var tm   = new TurnManager();
        tm.SetOrder(new[] { slow, fast });

        tm.Advance();
        Assert.That(tm.Current, Is.SameAs(slow));
    }

    [Test]
    public void Advance_ReturnsNull_WhenRoundComplete()
    {
        var a  = MakeUnit("A", speed: 50);
        var tm = new TurnManager();
        tm.SetOrder(new[] { a });

        var next = tm.Advance();
        Assert.That(next,             Is.Null);
        Assert.That(tm.IsRoundComplete, Is.True);
    }

    [Test]
    public void SetOrder_ExcludesDeadUnits()
    {
        var alive = MakeUnit("Alive", speed: 50);
        var dead  = MakeUnit("Dead",  speed: 90, hp: 1);
        dead.TakeDamage(1);  // kill it

        var tm = new TurnManager();
        tm.SetOrder(new[] { alive, dead });

        Assert.That(tm.Order.Count, Is.EqualTo(1));
        Assert.That(tm.Current,     Is.SameAs(alive));
    }

    [Test]
    public void Advance_SkipsUnitsThatDiedMidRound()
    {
        var first  = MakeUnit("First",  speed: 80);
        var second = MakeUnit("Second", speed: 60, hp: 1);
        var third  = MakeUnit("Third",  speed: 40);

        var tm = new TurnManager();
        tm.SetOrder(new[] { first, second, third });

        // Kill the second unit mid-round.
        second.TakeDamage(1);

        tm.Advance(); // skip to second (dead) → should land on third
        Assert.That(tm.Current, Is.SameAs(third));
    }

    [Test]
    public void SetOrder_EmptyList_RoundIsImmediatelyComplete()
    {
        var tm = new TurnManager();
        tm.SetOrder(Enumerable.Empty<UnitInstance>());

        Assert.That(tm.IsRoundComplete, Is.True);
        Assert.That(tm.Current,         Is.Null);
    }
}
