using System.Collections.Generic;
using NUnit.Framework;
using Lanes.Combat;
using Lanes.Combat.Units;

namespace Lanes.Tests;

/// <summary>
/// Tests for the lane switching mechanic.
/// Verifies cost calculation, boundary enforcement, and gauge spending.
/// </summary>
[TestFixture]
public sealed class LaneSwitcherTests
{
    private static UnitInstance MakeUnit(int lane = 1, float gaugeMax = 100f)
    {
        var classDef = new UnitClassDefinition
        {
            Id          = "test",
            Name        = "Test",
            Description = "",
            Role        = UnitRole.Melee,
            BaseStats   = new UnitBaseStats(MaxHp: 100, Attack: 50, Defense: 20, Speed: 40),
            Abilities   = new List<AbilityDefinition>(),
        };
        return new UnitInstance(classDef, "Tester", lane: lane, gaugeMax: gaugeMax);
    }

    // ── Successful switches ──────────────────────────────────────────────

    [Test]
    public void TrySwitchLane_OneStep_Succeeds()
    {
        var unit = MakeUnit(lane: 1);
        bool result = LaneSwitcher.TrySwitchLane(unit, 0);
        Assert.Multiple(() =>
        {
            Assert.That(result,    Is.True);
            Assert.That(unit.Lane, Is.EqualTo(0));
        });
    }

    [Test]
    public void TrySwitchLane_TwoSteps_CostsDouble()
    {
        var unit = MakeUnit(lane: 0);
        float before = unit.ActionGauge.Current;
        LaneSwitcher.TrySwitchLane(unit, 2);
        float spent = before - unit.ActionGauge.Current;
        Assert.That(spent, Is.EqualTo(LaneSwitcher.DefaultLaneSwitchCost * 2));
    }

    [Test]
    public void TrySwitchLane_SpendsGauge()
    {
        var unit = MakeUnit(lane: 1);
        float before = unit.ActionGauge.Current;
        LaneSwitcher.TrySwitchLane(unit, 2);
        Assert.That(unit.ActionGauge.Current, Is.EqualTo(before - LaneSwitcher.DefaultLaneSwitchCost));
    }

    // ── Failed switches ──────────────────────────────────────────────────

    [Test]
    public void TrySwitchLane_SameLane_Fails()
    {
        var unit = MakeUnit(lane: 1);
        bool result = LaneSwitcher.TrySwitchLane(unit, 1);
        Assert.That(result, Is.False);
    }

    [Test]
    public void TrySwitchLane_InvalidLane_Fails()
    {
        var unit = MakeUnit(lane: 1);
        Assert.That(LaneSwitcher.TrySwitchLane(unit, -1), Is.False);
        Assert.That(LaneSwitcher.TrySwitchLane(unit, 3),  Is.False);
    }

    [Test]
    public void TrySwitchLane_InsufficientGauge_Fails()
    {
        var unit = MakeUnit(lane: 0, gaugeMax: 10f);
        // Default cost is 15 per lane; gauge max is 10
        bool result = LaneSwitcher.TrySwitchLane(unit, 1);
        Assert.Multiple(() =>
        {
            Assert.That(result,    Is.False);
            Assert.That(unit.Lane, Is.EqualTo(0)); // unchanged
        });
    }

    [Test]
    public void TrySwitchLane_InsufficientGauge_DoesNotSpend()
    {
        var unit = MakeUnit(lane: 0, gaugeMax: 10f);
        float before = unit.ActionGauge.Current;
        LaneSwitcher.TrySwitchLane(unit, 1);
        Assert.That(unit.ActionGauge.Current, Is.EqualTo(before));
    }

    // ── Custom cost ──────────────────────────────────────────────────────

    [Test]
    public void TrySwitchLane_CustomCost_Applied()
    {
        var unit = MakeUnit(lane: 1);
        float before = unit.ActionGauge.Current;
        LaneSwitcher.TrySwitchLane(unit, 0, costPerLane: 25f);
        Assert.That(unit.ActionGauge.Current, Is.EqualTo(before - 25f));
    }

    // ── Null guard ───────────────────────────────────────────────────────

    [Test]
    public void TrySwitchLane_NullUnit_Throws()
    {
        Assert.Throws<System.ArgumentNullException>(
            () => LaneSwitcher.TrySwitchLane(null!, 1));
    }
}
