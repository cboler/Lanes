using NUnit.Framework;
using Lanes.Combat;
using Lanes.Combat.Units;
using Lanes.Data;
using Lanes.Data.Classes;

namespace Lanes.Tests;

/// <summary>
/// Verifies Archer class definition values, ability contracts,
/// and cross-lane capability.
/// </summary>
[TestFixture]
public sealed class ArcherTests
{
    private UnitClassDefinition _def = null!;

    [SetUp]
    public void SetUp() => _def = ArcherClassDef.Create();

    [Test]
    public void Archer_Id_IsArcher() =>
        Assert.That(_def.Id, Is.EqualTo("archer"));

    [Test]
    public void Archer_Role_IsRanged() =>
        Assert.That(_def.Role, Is.EqualTo(UnitRole.Ranged));

    [Test]
    public void Archer_HasThreeAbilities() =>
        Assert.That(_def.Abilities, Has.Count.EqualTo(3));

    [Test]
    public void Archer_QuickShot_IsCheapAndSingleTarget()
    {
        var ability = _def.Abilities[0];
        Assert.That(ability.Id,         Is.EqualTo("quick_shot"));
        Assert.That(ability.DamageType, Is.EqualTo(DamageType.Physical));
        Assert.That(ability.Target,     Is.EqualTo(AbilityTarget.SingleEnemy));
        Assert.That(ability.ActionCost, Is.LessThanOrEqualTo(25));
    }

    [Test]
    public void Archer_PiercingArrow_IsCrossLane()
    {
        var ability = _def.Abilities[1];
        Assert.That(ability.Id,        Is.EqualTo("piercing_arrow"));
        Assert.That(ability.CrossLane, Is.True);
        Assert.That(ability.Target,    Is.EqualTo(AbilityTarget.SingleEnemyAnyLane));
    }

    [Test]
    public void Archer_Volley_HitsSameLane()
    {
        var ability = _def.Abilities[2];
        Assert.That(ability.Id,     Is.EqualTo("volley"));
        Assert.That(ability.Target, Is.EqualTo(AbilityTarget.SameLaneEnemies));
    }

    [Test]
    public void Archer_Speed_IsHighest_AmongDefaults()
    {
        var fighter = FighterClassDef.Create();
        var cleric  = ClericClassDef.Create();
        Assert.That(_def.BaseStats.Speed,
            Is.GreaterThan(fighter.BaseStats.Speed).And.GreaterThan(cleric.BaseStats.Speed));
    }

    [Test]
    public void Archer_DamageOutput_IsPositive()
    {
        var unit    = new UnitInstance(_def, "Test Archer");
        var ability = _def.Abilities[1]; // piercing arrow (high multiplier)
        int dmg     = DamageCalculator.Calculate(unit, ability);
        Assert.That(dmg, Is.GreaterThan(0));
    }

    [Test]
    public void Archer_ThemeKey_CanBeReplaced()
    {
        var reskinned = ArcherClassDef.Create(themeKey: "ranger");
        Assert.That(reskinned.ThemeKey, Is.EqualTo("ranger"));
        Assert.That(reskinned.Id,       Is.EqualTo("archer"));
    }

    [Test]
    public void Archer_IsRegistered_InDefaultRegistry()
    {
        Assert.That(UnitClassRegistry.Default.TryGet("archer", out _), Is.True);
    }
}
