using NUnit.Framework;
using Lanes.Combat;
using Lanes.Combat.Units;
using Lanes.Data;
using Lanes.Data.Classes;

namespace Lanes.Tests;

/// <summary>
/// Verifies Witch class definition values, ability contracts,
/// and interaction with the damage calculator.
/// </summary>
[TestFixture]
public sealed class WitchTests
{
    private UnitClassDefinition _def = null!;

    [SetUp]
    public void SetUp() => _def = WitchClassDef.Create();

    [Test]
    public void Witch_Id_IsWitch() =>
        Assert.That(_def.Id, Is.EqualTo("witch"));

    [Test]
    public void Witch_Role_IsRanged() =>
        Assert.That(_def.Role, Is.EqualTo(UnitRole.Ranged));

    [Test]
    public void Witch_HasThreeAbilities() =>
        Assert.That(_def.Abilities, Has.Count.EqualTo(3));

    [Test]
    public void Witch_FireBolt_IsMagical()
    {
        var ability = _def.Abilities[0];
        Assert.That(ability.Id,         Is.EqualTo("fire_bolt"));
        Assert.That(ability.DamageType, Is.EqualTo(DamageType.Magical));
        Assert.That(ability.CrossLane,  Is.False);
    }

    [Test]
    public void Witch_Inferno_HitsSameLane()
    {
        var ability = _def.Abilities[1];
        Assert.That(ability.Id,     Is.EqualTo("inferno"));
        Assert.That(ability.Target, Is.EqualTo(AbilityTarget.SameLaneEnemies));
    }

    [Test]
    public void Witch_Meteor_HasFriendlyFire()
    {
        var ability = _def.Abilities[2];
        Assert.That(ability.Id,           Is.EqualTo("meteor"));
        Assert.That(ability.FriendlyFire, Is.True);
        Assert.That(ability.CrossLane,    Is.True);
        Assert.That(ability.Target,       Is.EqualTo(AbilityTarget.AllEnemies));
    }

    [Test]
    public void Witch_Stats_HighMagicAttackLowHp()
    {
        Assert.That(_def.BaseStats.MagicAttack, Is.GreaterThan(70));
        Assert.That(_def.BaseStats.MaxHp,       Is.LessThan(100));
    }

    [Test]
    public void Witch_DamageOutput_IsPositive()
    {
        var unit    = new UnitInstance(_def, "Test Witch");
        var ability = _def.Abilities[0]; // fire_bolt
        int dmg     = DamageCalculator.Calculate(unit, ability);
        Assert.That(dmg, Is.GreaterThan(0));
    }

    [Test]
    public void Witch_ThemeKey_DefaultsToId()
    {
        Assert.That(_def.ThemeKey, Is.EqualTo(_def.Id));
    }

    [Test]
    public void Witch_CustomThemeKey_IsPreserved()
    {
        var reskinned = WitchClassDef.Create(themeKey: "sorceress");
        Assert.That(reskinned.ThemeKey, Is.EqualTo("sorceress"));
        Assert.That(reskinned.Id,       Is.EqualTo("witch"));
    }

    [Test]
    public void Witch_IsRegistered_InDefaultRegistry()
    {
        Assert.That(UnitClassRegistry.Default.TryGet("witch", out _), Is.True);
    }
}
