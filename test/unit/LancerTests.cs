using NUnit.Framework;
using Lanes.Combat;
using Lanes.Combat.Units;
using Lanes.Data;
using Lanes.Data.Classes;

namespace Lanes.Tests;

/// <summary>
/// Verifies Lancer class definition values, ability contracts,
/// and interaction with the damage calculator.
/// </summary>
[TestFixture]
public sealed class LancerTests
{
    private UnitClassDefinition _def = null!;

    [SetUp]
    public void SetUp() => _def = LancerClassDef.Create();

    [Test]
    public void Lancer_Id_IsLancer() =>
        Assert.That(_def.Id, Is.EqualTo("lancer"));

    [Test]
    public void Lancer_Role_IsMelee() =>
        Assert.That(_def.Role, Is.EqualTo(UnitRole.Melee));

    [Test]
    public void Lancer_HasThreeAbilities() =>
        Assert.That(_def.Abilities, Has.Count.EqualTo(3));

    [Test]
    public void Lancer_Thrust_IsPhysical()
    {
        var ability = _def.Abilities[0];
        Assert.That(ability.Id,         Is.EqualTo("thrust"));
        Assert.That(ability.DamageType, Is.EqualTo(DamageType.Physical));
        Assert.That(ability.CrossLane,  Is.False);
    }

    [Test]
    public void Lancer_PiercingLunge_IsCrossLane()
    {
        var ability = _def.Abilities[1];
        Assert.That(ability.Id,        Is.EqualTo("piercing_lunge"));
        Assert.That(ability.CrossLane, Is.True);
        Assert.That(ability.Target,    Is.EqualTo(AbilityTarget.SingleEnemyAnyLane));
    }

    [Test]
    public void Lancer_Whirlwind_HitsSameLane()
    {
        var ability = _def.Abilities[2];
        Assert.That(ability.Id,     Is.EqualTo("whirlwind"));
        Assert.That(ability.Target, Is.EqualTo(AbilityTarget.SameLaneEnemies));
    }

    [Test]
    public void Lancer_Stats_HighAttackAndMeleeRange()
    {
        Assert.That(_def.BaseStats.Attack,     Is.GreaterThan(70));
        Assert.That(_def.BaseStats.MeleeRange, Is.EqualTo(2));
    }

    [Test]
    public void Lancer_DamageOutput_IsPositive()
    {
        var unit    = new UnitInstance(_def, "Test Lancer");
        var ability = _def.Abilities[0]; // thrust
        int dmg     = DamageCalculator.Calculate(unit, ability);
        Assert.That(dmg, Is.GreaterThan(0));
    }

    [Test]
    public void Lancer_ThemeKey_DefaultsToId()
    {
        Assert.That(_def.ThemeKey, Is.EqualTo(_def.Id));
    }

    [Test]
    public void Lancer_CustomThemeKey_IsPreserved()
    {
        var reskinned = LancerClassDef.Create(themeKey: "dragoon");
        Assert.That(reskinned.ThemeKey, Is.EqualTo("dragoon"));
        Assert.That(reskinned.Id,       Is.EqualTo("lancer"));
    }

    [Test]
    public void Lancer_IsRegistered_InDefaultRegistry()
    {
        Assert.That(UnitClassRegistry.Default.TryGet("lancer", out _), Is.True);
    }
}
