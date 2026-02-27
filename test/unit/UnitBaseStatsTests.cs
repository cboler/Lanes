using NUnit.Framework;
using Lanes.Combat.Units;

namespace Lanes.Tests;

[TestFixture]
public sealed class UnitBaseStatsTests
{
    [Test]
    public void DefaultMeleeRange_IsOne()
    {
        var stats = new UnitBaseStats(MaxHp: 100, Attack: 50, Defense: 30, Speed: 40);
        Assert.That(stats.MeleeRange, Is.EqualTo(1));
    }

    [Test]
    public void DefaultMagicStats_AreZero()
    {
        var stats = new UnitBaseStats(MaxHp: 100, Attack: 50, Defense: 30, Speed: 40);
        Assert.That(stats.MagicAttack,  Is.EqualTo(0));
        Assert.That(stats.MagicDefense, Is.EqualTo(0));
    }

    [Test]
    public void AllPropertiesRoundtrip()
    {
        var stats = new UnitBaseStats(
            MaxHp: 200, Attack: 70, Defense: 40,
            Speed: 60, MagicAttack: 30, MagicDefense: 20, MeleeRange: 2);

        Assert.Multiple(() =>
        {
            Assert.That(stats.MaxHp,        Is.EqualTo(200));
            Assert.That(stats.Attack,       Is.EqualTo(70));
            Assert.That(stats.Defense,      Is.EqualTo(40));
            Assert.That(stats.Speed,        Is.EqualTo(60));
            Assert.That(stats.MagicAttack,  Is.EqualTo(30));
            Assert.That(stats.MagicDefense, Is.EqualTo(20));
            Assert.That(stats.MeleeRange,   Is.EqualTo(2));
        });
    }

    [Test]
    public void RecordEquality_WorksCorrectly()
    {
        var a = new UnitBaseStats(100, 50, 30, 40);
        var b = new UnitBaseStats(100, 50, 30, 40);
        Assert.That(a, Is.EqualTo(b));
    }
}
