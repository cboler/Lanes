using System.Collections.Generic;
using NUnit.Framework;
using Lanes.Combat;
using Lanes.Combat.Units;
using Lanes.Data.Classes;

namespace Lanes.Tests;

[TestFixture]
public sealed class UnitInstanceTests
{
    private static UnitClassDefinition SimpleClassDef(int maxHp = 100) =>
        new()
        {
            Id          = "test",
            Name        = "Test",
            Description = "",
            Role        = UnitRole.Melee,
            BaseStats   = new UnitBaseStats(MaxHp: maxHp, Attack: 50, Defense: 20, Speed: 40),
            Abilities   = new List<AbilityDefinition>(),
        };

    [Test]
    public void NewInstance_StartsAtFullHp()
    {
        var unit = new UnitInstance(SimpleClassDef(120), "Hero");
        Assert.That(unit.CurrentHp, Is.EqualTo(120));
        Assert.That(unit.IsAlive,   Is.True);
    }

    [Test]
    public void TakeDamage_ReducesHp()
    {
        var unit = new UnitInstance(SimpleClassDef(100), "Hero");
        unit.TakeDamage(30);
        Assert.That(unit.CurrentHp, Is.EqualTo(70));
    }

    [Test]
    public void TakeDamage_ClampedToZero()
    {
        var unit = new UnitInstance(SimpleClassDef(100), "Hero");
        unit.TakeDamage(999);
        Assert.That(unit.CurrentHp, Is.EqualTo(0));
        Assert.That(unit.IsAlive,   Is.False);
    }

    [Test]
    public void Heal_RestoresHp()
    {
        var unit = new UnitInstance(SimpleClassDef(100), "Hero");
        unit.TakeDamage(50);
        unit.Heal(20);
        Assert.That(unit.CurrentHp, Is.EqualTo(70));
    }

    [Test]
    public void Heal_ClampedToMaxHp()
    {
        var unit = new UnitInstance(SimpleClassDef(100), "Hero");
        unit.TakeDamage(10);
        unit.Heal(999);
        Assert.That(unit.CurrentHp, Is.EqualTo(100));
    }

    [Test]
    public void ResetForBattle_RestoresFullHpAndGauge()
    {
        var unit = new UnitInstance(SimpleClassDef(100), "Hero");
        unit.TakeDamage(80);
        unit.ActionGauge.TrySpend(60f);
        unit.ResetForBattle();

        Assert.That(unit.CurrentHp,              Is.EqualTo(100));
        Assert.That(unit.ActionGauge.IsExhausted, Is.False);
    }

    [Test]
    public void DefaultLane_IsMiddle()
    {
        var unit = new UnitInstance(SimpleClassDef(), "Hero");
        Assert.That(unit.Lane, Is.EqualTo(1));
    }

    [Test]
    public void Stats_MatchClassDef()
    {
        var def  = SimpleClassDef(100);
        var unit = new UnitInstance(def, "Hero");
        Assert.That(unit.Stats, Is.SameAs(def.BaseStats));
    }
}
